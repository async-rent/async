import { payments, rentals } from "@async-rent/db";
import type { PaymentRow } from "@async-rent/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Payment, PaymentProvider } from "../schemas";
import { amountSchema, currencyCodeSchema, paymentProviderSchema, paymentSchema } from "../schemas";
import { attempt, createResult } from "../utils";

export const createProviderOrderInputSchema = z.object({
  reference: z
    .string()
    .describe("Rental reference to show on the provider's checkout, e.g. AR-2026-7KQ4M2."),
  amount: amountSchema.describe("Amount to charge, in the currency's minor unit."),
  currency: currencyCodeSchema,
  returnUrl: z.url().describe("Where the provider sends the customer after approving."),
  cancelUrl: z.url().describe("Where the provider sends the customer after backing out."),
});

export type CreateProviderOrderInput = z.infer<typeof createProviderOrderInputSchema>;

export const captureProviderOrderInputSchema = z.object({
  externalOrderId: z.string().describe("Provider-side order the customer approved."),
});

export type CaptureProviderOrderInput = z.infer<typeof captureProviderOrderInputSchema>;

export const getProviderOrderInputSchema = z.object({
  externalOrderId: z.string().describe("Provider-side order to look up."),
});

export type GetProviderOrderInput = z.infer<typeof getProviderOrderInputSchema>;

export const refundProviderPaymentInputSchema = z.object({
  externalPaymentId: z.string().describe("Provider-side payment to return."),
  amount: amountSchema.describe("Amount to return, in the currency's minor unit."),
  currency: currencyCodeSchema,
});

export type RefundProviderPaymentInput = z.infer<typeof refundProviderPaymentInputSchema>;

export const providerErrorCodeSchema = z
  .enum([
    "invalid_request",
    "provider_unreachable",
    "provider_refused",
    "provider_response_invalid",
    "payment_pending",
  ])
  .describe(
    "Why a provider call failed: the input broke the contract, the provider could not be reached, it refused the request, it answered in a shape the adapter does not know, or it has not settled the capture or refund yet.",
  );

export type ProviderErrorCode = z.infer<typeof providerErrorCodeSchema>;

export const captureOutcomeSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("succeeded"),
    externalPaymentId: z.string().describe("Provider-side payment the money settled as."),
  }),
  z.object({
    status: z.literal("failed"),
    failureReason: z.string().describe("Why the provider declined the charge, safe to show."),
  }),
]);

export type CaptureOutcome = z.infer<typeof captureOutcomeSchema>;

/** Result constructors for `PaymentProviderAdapter.createOrder`. */
export const createProviderOrderResult = createResult(
  z.object({
    externalOrderId: z.string().describe("Provider-side order the customer approves."),
    approvalUrl: z.url().describe("Where the customer approves the charge."),
  }),
  providerErrorCodeSchema,
);

export type CreateProviderOrderResult = z.infer<typeof createProviderOrderResult.schema>;

/** Result constructors for `PaymentProviderAdapter.captureOrder`. */
export const captureProviderOrderResult = createResult(
  captureOutcomeSchema,
  providerErrorCodeSchema,
);

export type CaptureProviderOrderResult = z.infer<typeof captureProviderOrderResult.schema>;

export const providerOrderStateSchema = z.discriminatedUnion("status", [
  z
    .object({ status: z.literal("open") })
    .describe("No money has moved and none can: the order is unapproved, expired or void."),
  z
    .object({ status: z.literal("approved") })
    .describe(
      "The customer approved the order but it has no capture yet, so a capture may be under way.",
    ),
  ...captureOutcomeSchema.options,
]);

export type ProviderOrderState = z.infer<typeof providerOrderStateSchema>;

/** Result constructors for `PaymentProviderAdapter.getOrder`. */
export const getProviderOrderResult = createResult(
  providerOrderStateSchema,
  providerErrorCodeSchema,
);

export type GetProviderOrderResult = z.infer<typeof getProviderOrderResult.schema>;

/** Result constructors for `PaymentProviderAdapter.refund`. */
export const refundProviderPaymentResult = createResult(z.void(), providerErrorCodeSchema);

export type RefundProviderPaymentResult = z.infer<typeof refundProviderPaymentResult.schema>;

/**
 * What a payment company must do for the payment service. The service only
 * talks to this interface, so adding a provider means writing one adapter and
 * registering it by name; nothing here changes. Each method's input has a
 * schema above, so an adapter can validate what it receives, and each returns
 * a result built with the matching constructors above.
 *
 * An adapter never throws. A charge the provider declines is not an error
 * either: `captureOrder` succeeds with a `failed` outcome, which the service
 * records so the customer can try again. Money the provider holds but has not
 * settled fails with `payment_pending`, so the service leaves the row as is.
 */
export interface PaymentProviderAdapter {
  /** Opens a charge at the provider and returns where the customer approves it. */
  createOrder(input: CreateProviderOrderInput): Promise<CreateProviderOrderResult>;

  /**
   * Takes the money once the customer has approved the order. Capturing an
   * order that was already captured returns that capture's outcome.
   */
  captureOrder(input: CaptureProviderOrderInput): Promise<CaptureProviderOrderResult>;

  /**
   * Reads where an order stands without changing it. Only an `open` order is
   * safe to replace; an `approved` one may be getting captured right now.
   */
  getOrder(input: GetProviderOrderInput): Promise<GetProviderOrderResult>;

  /** Returns a settled charge to the customer in full, less anything already refunded at the provider. */
  refund(input: RefundProviderPaymentInput): Promise<RefundProviderPaymentResult>;
}

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
    "payment_pending",
    "payment_replaced",
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
    "payment_pending",
    "payment_replaced",
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
    "refund_pending",
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

// Recording a provider's outcome on a pending payment, shared by confirm and start.
const settlePaymentResult = createResult(
  paymentSchema,
  z.enum(["payment_replaced", "failed_to_save_payment", "payment_data_invalid"]),
);

type SettlePaymentResult = z.infer<typeof settlePaymentResult.schema>;

/** The first weekly cycle: the amount captured at checkout. */
const firstBillingCycle = 1;

/** Statuses a first payment can be started again from (abandoned or declined). */
const restartableStatuses = ["pending", "failed"] as const;

/** Statuses a captured payment may still be recorded over (open, or a newer order declined). */
const unpaidStatuses = ["pending", "failed"] as const;

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
   *
   * An earlier order the customer already approved is captured first. If it
   * turns out to be paid, the payment is recorded and the call fails with
   * `payment_already_started`: callers should then show the rental as paid,
   * not as an error.
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

    // A pending row's order may already hold or have taken the customer's
    // money, e.g. a capture held for review or one whose reply was lost.
    // Replacing that order would orphan the money and let the customer pay
    // twice, so the provider is asked first.
    if (existing?.status === "pending") {
      const previousAdapter = providers[existing.provider];
      if (!previousAdapter) {
        return err("provider_not_configured", `Provider ${existing.provider} is not configured`);
      }

      const lookup = { externalOrderId: existing.externalOrderId };
      let previous: GetProviderOrderResult = await previousAdapter.getOrder(lookup);
      // An approved order may be getting captured by a confirm right now, and
      // replacing it would let both orders take money. Capturing it here too is
      // safe, since a capture of the same order replays the first one.
      if (previous.success && previous.data.status === "approved") {
        previous = await previousAdapter.captureOrder(lookup);
      }
      if (!previous.success) {
        return previous.error.code === "payment_pending"
          ? err(
              "payment_pending",
              `Rental ${rental.number} has a payment the provider is still holding`,
              previous.error,
            )
          : err("provider_request_failed", "The payment provider failed", previous.error);
      }

      if (previous.data.status === "succeeded") {
        const settled = await settle(existing, previous.data);
        if (!settled.success) return settled;

        return err("payment_already_started", `Rental ${rental.number} is already paid`);
      }
    }

    const order = await adapter.createOrder({
      reference: rental.number,
      amount: rental.totalDueToday,
      currency: rental.currency,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
    });
    if (!order.success) {
      return err("provider_request_failed", "The payment provider failed", order.error);
    }

    const charge = {
      provider: input.provider,
      externalOrderId: order.data.externalOrderId,
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

    return ok({ payment, approvalUrl: order.data.approvalUrl });
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

    const captured = await adapter.captureOrder({ externalOrderId: row.externalOrderId });
    if (!captured.success) {
      // Held money is not a provider fault: the payment stays pending and a
      // later confirm settles it.
      return captured.error.code === "payment_pending"
        ? err("payment_pending", `Payment ${row.id} is on hold at the provider`, captured.error)
        : err("provider_request_failed", "The payment provider failed", captured.error);
    }

    return settle(row, captured.data);
  }

  /**
   * Records a provider's outcome on a pending payment. The payment and its
   * rental move together: a captured payment confirms the rental, and either
   * outcome is copied onto it to avoid a join.
   *
   * `startPayment` may have swapped in a new order while the provider
   * answered. Money taken is recorded anyway, on the order that took it, even
   * over a decline of the newer order. A decline only counts for its own
   * order, so a newer one the customer opened stays as it is.
   */
  async function settle(row: PaymentRow, outcome: CaptureOutcome): Promise<SettlePaymentResult> {
    const { ok, err } = settlePaymentResult;

    const now = new Date();
    const paid = outcome.status === "succeeded";

    const saved = await attempt(
      db.batch([
        db
          .update(payments)
          .set(
            paid
              ? {
                  status: "succeeded",
                  externalOrderId: row.externalOrderId,
                  externalPaymentId: outcome.externalPaymentId,
                  failureReason: null,
                  paidAt: now,
                  updatedAt: now,
                }
              : { status: "failed", failureReason: outcome.failureReason, updatedAt: now },
          )
          .where(
            paid
              ? and(eq(payments.id, row.id), inArray(payments.status, unpaidStatuses))
              : and(
                  eq(payments.id, row.id),
                  eq(payments.status, "pending"),
                  eq(payments.externalOrderId, row.externalOrderId),
                ),
          )
          .returning(),
        db
          .update(rentals)
          .set(
            paid
              ? { status: "confirmed", paymentStatusSnapshot: "succeeded", updatedAt: now }
              : { paymentStatusSnapshot: "failed", updatedAt: now },
          )
          .where(
            and(
              eq(rentals.id, row.rentalId),
              eq(rentals.status, "pending_payment"),
              // Only once the payment holds this outcome, so the rental never
              // claims a payment the row does not record.
              inArray(
                rentals.id,
                db
                  .select({ rentalId: payments.rentalId })
                  .from(payments)
                  .where(
                    and(
                      eq(payments.id, row.id),
                      eq(payments.externalOrderId, row.externalOrderId),
                      paid
                        ? and(
                            eq(payments.status, "succeeded"),
                            eq(payments.externalPaymentId, outcome.externalPaymentId),
                          )
                        : eq(payments.status, "failed"),
                    ),
                  ),
              ),
            ),
          ),
        db.select().from(payments).where(eq(payments.id, row.id)).limit(1),
      ]),
    );
    if (!saved.ok) return err("failed_to_save_payment", "Failed to save payment", saved.error);

    const [[updated], , [current]] = saved.value;
    if (!current) return err("failed_to_save_payment", `Payment ${row.id} no longer exists`);

    // Nothing was written when another request settled the same order first
    // (its outcome stands) or when the payment moved on to another order.
    if (!updated && current.externalOrderId !== row.externalOrderId) {
      return err(
        "payment_replaced",
        paid
          ? `Order ${row.externalOrderId} took payment ${outcome.externalPaymentId}, but payment ${row.id} was already paid by order ${current.externalOrderId}; refund it at the provider`
          : `Order ${row.externalOrderId} was replaced by order ${current.externalOrderId}`,
      );
    }

    const payment = parsePayment(current);
    if (!payment) return err("payment_data_invalid", `Payment ${current.id} has invalid data`);

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

    const refunded = await adapter.refund({
      externalPaymentId: row.externalPaymentId,
      amount: row.amount,
      currency: row.currency,
    });
    if (!refunded.success) {
      // A refund the provider has not settled leaves the payment paid; asking
      // again reads where it stands without refunding twice.
      return refunded.error.code === "payment_pending"
        ? err("refund_pending", `Refund of payment ${row.id} is still processing`, refunded.error)
        : err("provider_request_failed", "The payment provider failed", refunded.error);
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
