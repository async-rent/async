import {
  billingAgreements,
  liveBillingAgreementStatusValues,
  payments,
  rentals,
} from "@async-rent/db";
import type { BillingAgreementRow } from "@async-rent/db";
import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type { BillingAgreement, RentalStatus } from "../schemas";
import { billingAgreementSchema, dateTimeSchema } from "../schemas";
import { attempt, createResult } from "../utils";
import type { PaymentService } from "./payment";

export interface CreateBillingServiceOptions {
  db: DrizzleD1Database;
  /** The payment service every weekly charge goes through. */
  payment: PaymentService;
}

/** Declined charges in a row after which a plan stops billing and is paused. */
export const maxFailedBillingAttempts = 3;

/** How long a declined week waits before it is charged again. */
export const billingRetryDelayMs = 24 * 60 * 60 * 1000;

/** How many due plans one run bills by default. */
const defaultRunLimit = 50;

const dayMs = 24 * 60 * 60 * 1000;
const weekMs = 7 * dayMs;

/** Payment statuses that mean a week was paid, even if refunded since. */
const paidPaymentStatuses = ["succeeded", "refunded"] as const;

/** Rental statuses that still have gear out and keep billing. */
const billableRentalStatuses = ["confirmed", "active"] as const satisfies readonly RentalStatus[];

export const runDueBillingInputSchema = z.object({
  now: dateTimeSchema.optional().describe("Bill every plan due by this time; defaults to now."),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe(
      `Most plans to bill in one run (default ${defaultRunLimit}); the rest wait for the next run.`,
    ),
});

export type RunDueBillingInput = z.infer<typeof runDueBillingInputSchema>;

export const getBillingPlanInputSchema = z.object({
  rentalId: z.string().describe("Rental whose billing plan to read."),
});

export type GetBillingPlanInput = z.infer<typeof getBillingPlanInputSchema>;

export const cancelBillingPlanInputSchema = z.object({
  rentalId: z.string().describe("Rental whose weekly billing to stop."),
});

export type CancelBillingPlanInput = z.infer<typeof cancelBillingPlanInputSchema>;

export const billingRunOutcomeSchema = z
  .enum(["charged", "declined", "paused", "ended", "retry_later"])
  .describe(
    "What a run did with one due plan: charged its next week, recorded a decline to retry, paused it after too many declines or a charge the provider holds, ended it because the rental is over, or left it for the next run because the outcome is not known yet.",
  );

export type BillingRunOutcome = z.infer<typeof billingRunOutcomeSchema>;

export const billingRunSchema = z.object({
  results: z.array(
    z.object({
      billingAgreementId: z.string(),
      rentalId: z.string(),
      outcome: billingRunOutcomeSchema,
      billingCycle: z.number().int().positive().optional().describe("Week the run charged."),
      reason: z.string().optional().describe("Why the charge did not go through."),
    }),
  ),
});

export type BillingRun = z.infer<typeof billingRunSchema>;

const runDueBillingResult = createResult(
  billingRunSchema,
  z.enum(["failed_to_load_billing_plans"]),
);

export const runDueBillingResultSchema = runDueBillingResult.schema;
export type RunDueBillingResult = z.infer<typeof runDueBillingResultSchema>;

const getBillingPlanResult = createResult(
  billingAgreementSchema,
  z.enum(["billing_plan_not_found", "failed_to_load_billing_plan", "billing_plan_data_invalid"]),
);

export const getBillingPlanResultSchema = getBillingPlanResult.schema;
export type GetBillingPlanResult = z.infer<typeof getBillingPlanResultSchema>;

const cancelBillingPlanResult = createResult(
  billingAgreementSchema,
  z.enum(["billing_plan_not_found", "failed_to_save_billing_plan", "billing_plan_data_invalid"]),
);

export const cancelBillingPlanResultSchema = cancelBillingPlanResult.schema;
export type CancelBillingPlanResult = z.infer<typeof cancelBillingPlanResultSchema>;

/**
 * When a week of a rental starts, which is when it is charged: week 1 on the
 * start date (paid at checkout), week 2 seven days later, and so on. Dates are
 * read as UTC midnight. Pure.
 */
export function billingCycleStartsAt(startDate: string, billingCycle: number): Date {
  return new Date(Date.parse(`${startDate}T00:00:00Z`) + (billingCycle - 1) * weekMs);
}

/**
 * Whether a week falls inside the rental: an open-ended rental bills every
 * week, one with an end date stops once a week would start after it. Pure.
 */
export function isBillingCycleInRental(
  rental: { startDate: string; endDate?: string },
  billingCycle: number,
): boolean {
  if (!rental.endDate) return true;

  // ISO dates compare correctly as strings.
  const weekStart = billingCycleStartsAt(rental.startDate, billingCycle).toISOString().slice(0, 10);

  return weekStart <= rental.endDate;
}

// Build a billing plan from its row. Pure.
function toBillingAgreement(row: BillingAgreementRow): BillingAgreement {
  return {
    id: row.id,
    rentalId: row.rentalId,
    provider: row.provider,
    providerAgreementId: row.providerAgreementId ?? undefined,
    interval: row.interval,
    currency: row.currency,
    status: row.status,
    nextChargeAt: row.nextChargeAt?.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString(),
    failedAttempts: row.failedAttempts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function parseBillingAgreement(row: BillingAgreementRow): BillingAgreement | undefined {
  const parsed = billingAgreementSchema.safeParse(toBillingAgreement(row));

  return parsed.success ? parsed.data : undefined;
}

/**
 * Weekly billing. A plan is opened by the payment service when the first week
 * is paid at checkout; from then on `runDueBilling` charges each following
 * week through the payment service until the rental ends, the plan is
 * cancelled, or too many charges in a row are declined.
 */
export function createBillingService({ db, payment }: CreateBillingServiceOptions) {
  // The last week already paid (or paid and refunded) for the plan's rental.
  const lastPaidCycle = sql<number>`(${db
    .select({ cycle: sql`coalesce(max(${payments.billingCycle}), 1)` })
    .from(payments)
    .where(
      and(
        eq(payments.rentalId, billingAgreements.rentalId),
        inArray(payments.status, paidPaymentStatuses),
      ),
    )})`.mapWith(Number);

  async function endPlan(
    agreement: BillingAgreementRow,
    status: "completed" | "cancelled",
    now: Date,
  ): Promise<void> {
    await db
      .update(billingAgreements)
      .set({
        status,
        nextChargeAt: null,
        cancelledAt: status === "cancelled" ? now : agreement.cancelledAt,
        updatedAt: now,
      })
      .where(and(eq(billingAgreements.id, agreement.id), eq(billingAgreements.status, "active")));
  }

  /**
   * Bills every active plan whose next week is due by `now`, oldest first, one
   * week per plan per run. Meant to run on a schedule (e.g. hourly): a plan
   * behind by more than a week catches up one week per run.
   *
   * - A paid week moves the plan to the start of the week after it.
   * - A declined week is retried after `billingRetryDelayMs`, and after
   *   `maxFailedBillingAttempts` declines in a row the plan is paused.
   * - A charge the provider holds (`payment_pending`) pauses the plan, since
   *   the provider forgets the charge's key after a few hours and a later run
   *   could then charge the week again. Someone checks it at the provider.
   * - A rental that is over (cancelled, completed, gear returned, or past its
   *   end date) ends its plan without a charge.
   * - When the outcome is unknown (the provider was unreachable or saving
   *   failed) or the fault is ours (no provider configured), the plan is left
   *   as is and the next run replays the same charge, which the provider does
   *   not take twice.
   *
   * One plan failing never stops the run; each plan's outcome is listed.
   */
  async function runDueBilling(input: RunDueBillingInput = {}): Promise<RunDueBillingResult> {
    const { ok, err } = runDueBillingResult;

    const now = input.now ? new Date(input.now) : new Date();

    const loaded = await attempt(
      db
        .select({
          agreement: billingAgreements,
          rentalStatus: rentals.status,
          fulfillmentStatus: rentals.fulfillmentStatus,
          startDate: rentals.startDate,
          endDate: rentals.endDate,
          lastPaidCycle,
        })
        .from(billingAgreements)
        .innerJoin(rentals, eq(rentals.id, billingAgreements.rentalId))
        .where(
          and(eq(billingAgreements.status, "active"), lte(billingAgreements.nextChargeAt, now)),
        )
        .orderBy(asc(billingAgreements.nextChargeAt), asc(billingAgreements.id))
        .limit(input.limit ?? defaultRunLimit),
    );
    if (!loaded.ok) {
      return err("failed_to_load_billing_plans", "Failed to load due billing plans", loaded.error);
    }

    const results: BillingRun["results"] = [];

    for (const due of loaded.value) {
      const { agreement } = due;
      const base = { billingAgreementId: agreement.id, rentalId: agreement.rentalId };
      const billingCycle = due.lastPaidCycle + 1;

      const rentalOver =
        !billableRentalStatuses.some((status) => status === due.rentalStatus) ||
        due.fulfillmentStatus === "returned" ||
        !isBillingCycleInRental(
          { startDate: due.startDate, endDate: due.endDate ?? undefined },
          billingCycle,
        );
      if (rentalOver) {
        const ended = await attempt(
          endPlan(agreement, due.rentalStatus === "cancelled" ? "cancelled" : "completed", now),
        );
        results.push(
          ended.ok
            ? { ...base, outcome: "ended" }
            : { ...base, outcome: "retry_later", reason: "Failed to end the billing plan" },
        );
        continue;
      }

      const charged = await payment.chargeBillingCycle({
        billingAgreementId: agreement.id,
        billingCycle,
        attempt: agreement.failedAttempts,
      });

      // Anything but a decline means the week was paid, even if refunded since.
      // The payment service moved the plan on with the payment.
      if (charged.success && charged.data.status !== "failed") {
        results.push({ ...base, outcome: "charged", billingCycle });
        continue;
      }

      const code = charged.success ? undefined : charged.error.code;
      const reason = charged.success ? charged.data.failureReason : charged.error.message;
      const held = code === "payment_pending";

      // Only a recorded decline, or a charge the customer's plan cannot make,
      // counts against the plan. Anything else is retried as the same attempt.
      const counts =
        charged.success || code === "provider_refused" || code === "no_saved_payment_method";
      if (!counts && !held) {
        results.push({ ...base, outcome: "retry_later", billingCycle, reason });
        continue;
      }

      const failedAttempts = counts ? agreement.failedAttempts + 1 : agreement.failedAttempts;
      const pause = held || failedAttempts >= maxFailedBillingAttempts;
      const saved = await attempt(
        db
          .update(billingAgreements)
          .set({
            failedAttempts,
            status: pause ? "paused" : "active",
            nextChargeAt: pause ? null : new Date(now.getTime() + billingRetryDelayMs),
            updatedAt: now,
          })
          .where(
            and(eq(billingAgreements.id, agreement.id), eq(billingAgreements.status, "active")),
          ),
      );

      results.push({
        ...base,
        outcome: !saved.ok ? "retry_later" : pause ? "paused" : "declined",
        billingCycle,
        reason,
      });
    }

    return ok({ results });
  }

  /** The rental's billing plan: its live one, otherwise the latest that ended. */
  async function getBillingPlan(input: GetBillingPlanInput): Promise<GetBillingPlanResult> {
    const { ok, err } = getBillingPlanResult;

    const rows = await attempt(
      db
        .select()
        .from(billingAgreements)
        .where(eq(billingAgreements.rentalId, input.rentalId))
        .orderBy(
          desc(inArray(billingAgreements.status, [...liveBillingAgreementStatusValues])),
          desc(billingAgreements.createdAt),
        )
        .limit(1),
    );
    if (!rows.ok) {
      return err("failed_to_load_billing_plan", "Failed to load billing plan", rows.error);
    }

    const [row] = rows.value;
    if (!row) {
      return err("billing_plan_not_found", `Rental ${input.rentalId} has no billing plan`);
    }

    const plan = parseBillingAgreement(row);

    return plan
      ? ok(plan)
      : err("billing_plan_data_invalid", `Billing plan ${row.id} has invalid data`);
  }

  /**
   * Stops a rental's weekly billing for good, whether it is active or paused.
   * Weeks already paid stay paid; nothing is refunded.
   */
  async function cancelBillingPlan(
    input: CancelBillingPlanInput,
  ): Promise<CancelBillingPlanResult> {
    const { ok, err } = cancelBillingPlanResult;

    const now = new Date();
    const updated = await attempt(
      db
        .update(billingAgreements)
        .set({ status: "cancelled", cancelledAt: now, nextChargeAt: null, updatedAt: now })
        .where(
          and(
            eq(billingAgreements.rentalId, input.rentalId),
            inArray(billingAgreements.status, [...liveBillingAgreementStatusValues]),
          ),
        )
        .returning(),
    );
    if (!updated.ok) {
      return err("failed_to_save_billing_plan", "Failed to save billing plan", updated.error);
    }

    const [row] = updated.value;
    if (!row) {
      return err("billing_plan_not_found", `Rental ${input.rentalId} has no live billing plan`);
    }

    const plan = parseBillingAgreement(row);

    return plan
      ? ok(plan)
      : err("billing_plan_data_invalid", `Billing plan ${row.id} has invalid data`);
  }

  return {
    runDueBilling,
    getBillingPlan,
    cancelBillingPlan,
    // Pure helpers, exposed on the service so apps use one surface.
    billingCycleStartsAt,
    isBillingCycleInRental,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
