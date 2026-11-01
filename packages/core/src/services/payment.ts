import { payments, rentals } from "@async-rent/db";
import type { PaymentRow } from "@async-rent/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Payment, PaymentProvider } from "../schemas";
import { paymentProviderSchema, paymentSchema } from "../schemas";
import { attempt, createResult } from "../utils";

/**
 * What a payment company must do for the payment service. The service only
 * talks to this interface, so adding a provider means writing one adapter and
 * registering it by name; nothing here changes.
 *
 * An adapter throws when the provider cannot be reached. A charge the provider
 * refuses is not an error: `captureOrder` reports it as a `failed` outcome.
 */
export interface PaymentProviderAdapter {
  /** Opens a charge at the provider and returns where the customer approves it. */
  createOrder(input: {
    /** Rental reference to show on the provider's checkout, e.g. AR-2026-7KQ4M2. */
    reference: string;
    amount: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<{ externalOrderId: string; approvalUrl: string }>;

  /** Takes the money once the customer has approved the order. */
  captureOrder(input: { externalOrderId: string }): Promise<CaptureOutcome>;

  /** Returns a settled charge to the customer in full. */
  refund(input: { externalPaymentId: string; amount: number; currency: string }): Promise<void>;
}

export type CaptureOutcome =
  | { status: "succeeded"; externalPaymentId: string }
  | { status: "failed"; failureReason: string };

/** The adapters a deployment has configured, keyed by provider name. */
export type PaymentProviders = Partial<Record<PaymentProvider, PaymentProviderAdapter>>;

export interface CreatePaymentServiceOptions {
  db: DrizzleD1Database;
  providers: PaymentProviders;
}

export const startPaymentInputSchema = z.object({
  rentalId: z.string().describe("Rental awaiting its first payment."),
  provider: paymentProviderSchema.describe("Provider the customer pays with."),
  returnUrl: z.url().describe("Where the provider sends the customer after approving."),
  cancelUrl: z.url().describe("Where the provider sends the customer after backing out."),
});

export type StartPaymentInput = z.infer<typeof startPaymentInputSchema>;

export const confirmPaymentInputSchema = z.object({
  provider: paymentProviderSchema.describe("Provider that called back."),
  externalOrderId: z.string().describe("Provider-side order the customer approved."),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentInputSchema>;

export const refundPaymentInputSchema = z.object({
  paymentId: z.string().describe("Settled payment to refund in full."),
});

export type RefundPaymentInput = z.infer<typeof refundPaymentInputSchema>;

export const listPaymentsInputSchema = z.object({
  rentalId: z.string().describe("Rental whose charges to list."),
});

export type ListPaymentsInput = z.infer<typeof listPaymentsInputSchema>;

const startPaymentResult = createResult(
  z.object({
    payment: paymentSchema,
    approvalUrl: z.url().describe("Where to send the customer to approve the charge."),
  }),
  z.enum([
    "provider_not_configured",
    "rental_not_found",
    "rental_not_payable",
    "payment_already_started",
    "provider_request_failed",
    "failed_to_load_rental",
    "failed_to_save_payment",
    "payment_data_invalid",
  ]),
);

export const startPaymentResultSchema = startPaymentResult.schema;
export type StartPaymentResult = z.infer<typeof startPaymentResultSchema>;

const confirmPaymentResult = createResult(
  paymentSchema,
  z.enum([
    "provider_not_configured",
    "payment_not_found",
    "provider_request_failed",
    "failed_to_load_payment",
    "failed_to_save_payment",
    "payment_data_invalid",
  ]),
);

export const confirmPaymentResultSchema = confirmPaymentResult.schema;
export type ConfirmPaymentResult = z.infer<typeof confirmPaymentResultSchema>;

const refundPaymentResult = createResult(
  paymentSchema,
  z.enum([
    "payment_not_found",
    "payment_not_refundable",
    "provider_not_configured",
    "provider_request_failed",
    "failed_to_load_payment",
    "failed_to_save_payment",
    "payment_data_invalid",
  ]),
);

export const refundPaymentResultSchema = refundPaymentResult.schema;
export type RefundPaymentResult = z.infer<typeof refundPaymentResultSchema>;

const listPaymentsResult = createResult(
  z.array(paymentSchema),
  z.enum(["failed_to_list_payments"]),
);

export const listPaymentsResultSchema = listPaymentsResult.schema;
export type ListPaymentsResult = z.infer<typeof listPaymentsResultSchema>;

/** The first weekly cycle: the amount captured at checkout. */
const firstBillingCycle = 1;

/** Statuses a first payment can be started again from (abandoned or declined). */
const restartableStatuses = ["pending", "failed"] as const;

// Build a payment from its row. Pure.
function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    rentalId: row.rentalId,
    billingAgreementId: row.billingAgreementId ?? undefined,
    billingCycle: row.billingCycle,
    provider: row.provider,
    externalOrderId: row.externalOrderId,
    externalPaymentId: row.externalPaymentId ?? undefined,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paidAt: row.paidAt?.toISOString(),
    failureReason: row.failureReason ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

// The payment when its row fits the schema, otherwise `undefined`.
function parsePayment(row: PaymentRow): Payment | undefined {
  const parsed = paymentSchema.safeParse(toPayment(row));

  return parsed.success ? parsed.data : undefined;
}

export function createPaymentService({ db, providers }: CreatePaymentServiceOptions) {
  /**
   * Prepares a rental's first charge and hands back where the customer
   * approves it. Calling it again for an abandoned or declined attempt opens a
   * fresh order on the same payment row, because a rental has one row per cycle.
   */
  async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
    const { ok, err } = startPaymentResult;

    const adapter = providers[input.provider];
    if (!adapter) {
      return err("provider_not_configured", `Provider ${input.provider} is not configured`);
    }

    const loaded = await attempt(
      db.batch([
        db.select().from(rentals).where(eq(rentals.id, input.rentalId)).limit(1),
        db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.rentalId, input.rentalId),
              eq(payments.billingCycle, firstBillingCycle),
            ),
          )
          .limit(1),
      ]),
    );
    if (!loaded.ok) return err("failed_to_load_rental", "Failed to load rental", loaded.error);

    const [[rental], [existing]] = loaded.value;
    if (!rental) return err("rental_not_found", `Rental ${input.rentalId} not found`);
    if (rental.status !== "pending_payment") {
      return err("rental_not_payable", `Rental ${rental.number} is ${rental.status}`);
    }
    if (existing && !isRestartable(existing.status)) {
      return err("payment_already_started", `Rental ${rental.number} already has a payment`);
    }

    const order = await attempt(
      adapter.createOrder({
        reference: rental.number,
        amount: rental.totalDueToday,
        currency: rental.currency,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
      }),
    );
    if (!order.ok) {
      return err("provider_request_failed", "The payment provider failed", order.error);
    }

    const charge = {
      provider: input.provider,
      externalOrderId: order.value.externalOrderId,
      externalPaymentId: null,
      amount: rental.totalDueToday,
      currency: rental.currency,
      status: "pending",
      paidAt: null,
      failureReason: null,
    } as const;

    const saved = await attempt(
      existing
        ? db
            .update(payments)
            .set({ ...charge, updatedAt: new Date() })
            .where(and(eq(payments.id, existing.id), inArray(payments.status, restartableStatuses)))
            .returning()
        : db
            .insert(payments)
            .values({
              ...charge,
              id: uuid(),
              rentalId: rental.id,
              billingCycle: firstBillingCycle,
            })
            .returning(),
    );
    if (!saved.ok) return err("failed_to_save_payment", "Failed to save payment", saved.error);

    const [row] = saved.value;
    if (!row) return err("failed_to_save_payment", "Failed to save payment");

    const payment = parsePayment(row);
    if (!payment) return err("payment_data_invalid", `Payment ${row.id} has invalid data`);

    return ok({ payment, approvalUrl: order.value.approvalUrl });
  }

  /**
   * Settles a payment once the customer is back from the provider. The order
   * id is what a provider callback carries, so that is what it resolves on. A
   * replayed callback finds the payment already settled and returns it as is.
   */
  async function confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    const { ok, err } = confirmPaymentResult;

    const adapter = providers[input.provider];
    if (!adapter) {
      return err("provider_not_configured", `Provider ${input.provider} is not configured`);
    }

    const rows = await attempt(
      db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.provider, input.provider),
            eq(payments.externalOrderId, input.externalOrderId),
          ),
        )
        .limit(1),
    );
    if (!rows.ok) return err("failed_to_load_payment", "Failed to load payment", rows.error);

    const [row] = rows.value;
    if (!row) return err("payment_not_found", `Order ${input.externalOrderId} not found`);

    if (row.status !== "pending") {
      const payment = parsePayment(row);

      return payment ? ok(payment) : err("payment_data_invalid", `Payment ${row.id} is invalid`);
    }

    const captured = await attempt(adapter.captureOrder({ externalOrderId: row.externalOrderId }));
    if (!captured.ok) {
      return err("provider_request_failed", "The payment provider failed", captured.error);
    }

    const outcome = captured.value;
    const now = new Date();

    // The payment and its rental move together: a captured payment confirms the
    // rental, and either outcome is copied onto it to avoid a join.
    const saved = await attempt(
      db.batch([
        db
          .update(payments)
          .set(
            outcome.status === "succeeded"
              ? {
                  status: "succeeded",
                  externalPaymentId: outcome.externalPaymentId,
                  paidAt: now,
                  updatedAt: now,
                }
              : { status: "failed", failureReason: outcome.failureReason, updatedAt: now },
          )
          .where(and(eq(payments.id, row.id), eq(payments.status, "pending")))
          .returning(),
        db
          .update(rentals)
          .set(
            outcome.status === "succeeded"
              ? { status: "confirmed", paymentStatusSnapshot: "succeeded", updatedAt: now }
              : { paymentStatusSnapshot: "failed", updatedAt: now },
          )
          .where(and(eq(rentals.id, row.rentalId), eq(rentals.status, "pending_payment"))),
      ]),
    );
    if (!saved.ok) return err("failed_to_save_payment", "Failed to save payment", saved.error);

    const [[settled]] = saved.value;
    // Another request settled it between the read and the write.
    if (!settled) return err("failed_to_save_payment", "Payment was settled by another request");

    const payment = parsePayment(settled);
    if (!payment) return err("payment_data_invalid", `Payment ${settled.id} has invalid data`);

    return ok(payment);
  }

  /** Returns a succeeded payment to the customer in full. */
  async function refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const { ok, err } = refundPaymentResult;

    const rows = await attempt(
      db.select().from(payments).where(eq(payments.id, input.paymentId)).limit(1),
    );
    if (!rows.ok) return err("failed_to_load_payment", "Failed to load payment", rows.error);

    const [row] = rows.value;
    if (!row) return err("payment_not_found", `Payment ${input.paymentId} not found`);
    if (row.status !== "succeeded" || !row.externalPaymentId) {
      return err("payment_not_refundable", `Payment ${row.id} is ${row.status}`);
    }

    const adapter = providers[row.provider];
    if (!adapter) {
      return err("provider_not_configured", `Provider ${row.provider} is not configured`);
    }

    const refunded = await attempt(
      adapter.refund({
        externalPaymentId: row.externalPaymentId,
        amount: row.amount,
        currency: row.currency,
      }),
    );
    if (!refunded.ok) {
      return err("provider_request_failed", "The payment provider failed", refunded.error);
    }

    const now = new Date();

    const saved = await attempt(
      db.batch([
        db
          .update(payments)
          .set({ status: "refunded", updatedAt: now })
          .where(and(eq(payments.id, row.id), eq(payments.status, "succeeded")))
          .returning(),
        db
          .update(rentals)
          .set({ paymentStatusSnapshot: "refunded", updatedAt: now })
          .where(eq(rentals.id, row.rentalId)),
      ]),
    );
    if (!saved.ok) return err("failed_to_save_payment", "Failed to save payment", saved.error);

    const [[settled]] = saved.value;
    if (!settled) return err("failed_to_save_payment", "Payment was refunded by another request");

    const payment = parsePayment(settled);
    if (!payment) return err("payment_data_invalid", `Payment ${settled.id} has invalid data`);

    return ok(payment);
  }

  /** Every charge on a rental, oldest cycle first: paid, failed and refunded alike. */
  async function listPayments(input: ListPaymentsInput): Promise<ListPaymentsResult> {
    const { ok, err } = listPaymentsResult;

    const rows = await attempt(
      db
        .select()
        .from(payments)
        .where(eq(payments.rentalId, input.rentalId))
        .orderBy(asc(payments.billingCycle)),
    );
    if (!rows.ok) return err("failed_to_list_payments", "Failed to list payments", rows.error);

    // A payment that no longer fits the schema is left out rather than failing
    // the whole list, matching the rental service's read.
    return ok(rows.value.flatMap((row) => parsePayment(row) ?? []));
  }

  return { startPayment, confirmPayment, refundPayment, listPayments };
}

export type PaymentService = ReturnType<typeof createPaymentService>;

function isRestartable(status: PaymentRow["status"]): boolean {
  return restartableStatuses.some((restartable) => restartable === status);
}
