import { describe, expect, it, vi } from "vite-plus/test";
import { createTestDatabase } from "../../tests/database";
import { billingCycleStartsAt, createBillingService, isBillingCycleInRental } from "./billing";
import {
  captureProviderOrderResult,
  chargeSavedPaymentMethodResult,
  createPaymentService,
  createProviderOrderResult,
  getProviderOrderResult,
  refundProviderPaymentResult,
} from "./payment";
import type { PaymentProviderAdapter } from "./payment";
import { createPricingService } from "./pricing";
import { createRentalService } from "./rental";

const urls = { returnUrl: "https://async.rent/paid", cancelUrl: "https://async.rent/cart" };

function setup({ endDate }: { endDate?: string } = {}) {
  const database = createTestDatabase();

  database.sqlite
    .prepare(
      `INSERT INTO locations (id, slug, name, country, timezone, currency, delivery_fee, status)
        VALUES ('loc_bali', 'bali', 'Bali', 'Indonesia', 'Asia/Makassar', 'USD', 1000, 'active')`,
    )
    .run();
  database.sqlite
    .prepare(
      `INSERT INTO rentals (id, number, contact_name, contact_email, address_line1, address_city,
        address_country_code, location_id, currency, start_date, end_date, status, weekly_subtotal,
        deposit, delivery_fee, discount, total_due_today)
      VALUES ('rental_1', 'AR-2026-AAAAAA', 'Ada', 'ada@example.com', '1 Jalan', 'Ubud', 'ID',
        'loc_bali', 'USD', '2026-02-01', ?, 'pending_payment', 12000, 24000, 1000, 0, 37000)`,
    )
    .run(endDate ?? null);

  const adapter: PaymentProviderAdapter = {
    createOrder: vi.fn(async () =>
      createProviderOrderResult.ok({
        externalOrderId: "order_1",
        approvalUrl: "https://pay.example.com/approve",
      }),
    ),
    captureOrder: vi.fn(async () =>
      captureProviderOrderResult.ok({
        status: "succeeded",
        externalPaymentId: "capture_1",
        savedPaymentMethodId: "vault_1",
      }),
    ),
    getOrder: vi.fn(async () => getProviderOrderResult.ok({ status: "open" })),
    refund: vi.fn(async () => refundProviderPaymentResult.ok()),
  } as Omit<PaymentProviderAdapter, "chargeSavedPaymentMethod"> as PaymentProviderAdapter;

  const charge = vi.fn<PaymentProviderAdapter["chargeSavedPaymentMethod"]>(
    async ({ idempotencyKey }) =>
      chargeSavedPaymentMethodResult.ok({
        externalOrderId: `order_${idempotencyKey}`,
        outcome: { status: "succeeded", externalPaymentId: `capture_${idempotencyKey}` },
      }),
  );
  adapter.chargeSavedPaymentMethod = charge;

  const payment = createPaymentService({ db: database.db, providers: { paypal: adapter } });
  const billing = createBillingService({ db: database.db, payment });
  const rental = createRentalService({ db: database.db, pricing: createPricingService() });

  // Pays week 1 at checkout, which opens the weekly plan.
  async function checkout() {
    const started = await payment.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });
    if (!started.success) throw new Error(started.error.message);

    const confirmed = await payment.confirmPayment({
      provider: "paypal",
      externalOrderId: started.data.payment.externalOrderId,
    });
    if (!confirmed.success) throw new Error(confirmed.error.message);
  }

  async function plan() {
    const read = await billing.getBillingPlan({ rentalId: "rental_1" });
    if (!read.success) throw new Error(read.error.message);

    return read.data;
  }

  const payments = () =>
    database.sqlite
      .prepare(
        `select billing_cycle as billingCycle, amount, status, billing_agreement_id as agreementId,
          failure_reason as failureReason from payments order by billing_cycle`,
      )
      .all();

  return { ...database, payment, billing, rental, charge, checkout, plan, payments };
}

describe("weekly billing plan", () => {
  it("opens when the first week is paid, due a week after the start", async () => {
    const s = setup();

    await s.checkout();

    expect(await s.plan()).toMatchObject({
      rentalId: "rental_1",
      provider: "paypal",
      providerAgreementId: "vault_1",
      status: "active",
      currency: "USD",
      failedAttempts: 0,
      nextChargeAt: "2026-02-08T00:00:00.000Z",
    });
  });

  it("is not opened twice when the payment is confirmed again", async () => {
    const s = setup();
    await s.checkout();

    await s.payment.confirmPayment({ provider: "paypal", externalOrderId: "order_1" });

    expect(s.sqlite.prepare("select count(*) as total from billing_agreements").get()).toEqual({
      total: 1,
    });
  });
});

describe("runDueBilling", () => {
  it("bills nothing before the next week is due", async () => {
    const s = setup();
    await s.checkout();

    const run = await s.billing.runDueBilling({ now: "2026-02-07T23:00:00Z" });

    expect(run).toEqual({ success: true, data: { results: [] } });
    expect(s.charge).not.toHaveBeenCalled();
  });

  it("charges the next week at the weekly price and moves the plan a week on", async () => {
    const s = setup();
    await s.checkout();
    const { id } = await s.plan();

    const run = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(run).toMatchObject({
      success: true,
      data: { results: [{ billingAgreementId: id, outcome: "charged", billingCycle: 2 }] },
    });
    expect(s.charge).toHaveBeenCalledWith({
      savedPaymentMethodId: "vault_1",
      reference: "AR-2026-AAAAAA",
      amount: 12000,
      currency: "USD",
      idempotencyKey: `renewal-${id}-2-0`,
    });
    expect(s.payments()).toEqual([
      expect.objectContaining({ billingCycle: 1, amount: 37000, status: "succeeded" }),
      { billingCycle: 2, amount: 12000, status: "succeeded", agreementId: id, failureReason: null },
    ]);
    expect(await s.plan()).toMatchObject({ nextChargeAt: "2026-02-15T00:00:00.000Z" });
  });

  it("does not charge a week twice when rerun", async () => {
    const s = setup();
    await s.checkout();
    await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    const run = await s.billing.runDueBilling({ now: "2026-02-08T02:00:00Z" });

    expect(run).toEqual({ success: true, data: { results: [] } });
    expect(s.charge).toHaveBeenCalledTimes(1);
  });

  it("retries a declined week a day later and pauses after three declines in a row", async () => {
    const s = setup();
    await s.checkout();
    const { id } = await s.plan();
    s.charge.mockResolvedValue(
      chargeSavedPaymentMethodResult.ok({
        outcome: { status: "failed", failureReason: "The payment method was declined." },
      }),
    );

    const first = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(first).toMatchObject({
      data: { results: [{ outcome: "declined", reason: "The payment method was declined." }] },
    });
    expect(await s.plan()).toMatchObject({
      status: "active",
      failedAttempts: 1,
      nextChargeAt: "2026-02-09T01:00:00.000Z",
    });
    expect(s.payments()[1]).toMatchObject({ billingCycle: 2, status: "failed" });

    await s.billing.runDueBilling({ now: "2026-02-09T01:00:00Z" });
    const third = await s.billing.runDueBilling({ now: "2026-02-10T01:00:00Z" });

    expect(third).toMatchObject({ data: { results: [{ outcome: "paused" }] } });
    const paused = await s.plan();
    expect(paused).toMatchObject({ status: "paused", failedAttempts: 3 });
    expect(paused.nextChargeAt).toBeUndefined();
    // Each attempt is a fresh charge, on the same week's row.
    expect(s.charge.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      `renewal-${id}-2-0`,
      `renewal-${id}-2-1`,
      `renewal-${id}-2-2`,
    ]);
    expect(s.payments()).toHaveLength(2);
  });

  it("replays the same charge when the provider's reply was lost", async () => {
    const s = setup();
    await s.checkout();
    s.charge.mockResolvedValueOnce(
      chargeSavedPaymentMethodResult.err("provider_unreachable", "PayPal could not be reached"),
    );

    const lost = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });
    const retried = await s.billing.runDueBilling({ now: "2026-02-08T02:00:00Z" });

    expect(lost).toMatchObject({ data: { results: [{ outcome: "retry_later" }] } });
    expect(retried).toMatchObject({ data: { results: [{ outcome: "charged" }] } });
    const [first, second] = s.charge.mock.calls.map(([input]) => input.idempotencyKey);
    expect(second).toBe(first);
  });

  it("ends the plan without charging once the rental's end date has passed", async () => {
    const s = setup({ endDate: "2026-02-07" });
    await s.checkout();

    const run = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(run).toMatchObject({ data: { results: [{ outcome: "ended" }] } });
    expect(s.charge).not.toHaveBeenCalled();
    expect(await s.plan()).toMatchObject({ status: "completed" });
  });

  it("ends the plan without charging once the gear is returned", async () => {
    const s = setup();
    await s.checkout();
    s.sqlite.exec("update rentals set fulfillment_status = 'returned'");

    const run = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(run).toMatchObject({ data: { results: [{ outcome: "ended" }] } });
    expect(s.charge).not.toHaveBeenCalled();
  });

  it("counts a plan with no saved payment method as a failed charge", async () => {
    const s = setup();
    await s.checkout();
    s.sqlite.exec("update billing_agreements set provider_agreement_id = null");

    const run = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(run).toMatchObject({ data: { results: [{ outcome: "declined" }] } });
    expect(s.charge).not.toHaveBeenCalled();
  });
});

describe("cancelling", () => {
  it("cancelBillingPlan stops billing at any time", async () => {
    const s = setup();
    await s.checkout();

    const cancelled = await s.billing.cancelBillingPlan({ rentalId: "rental_1" });
    const run = await s.billing.runDueBilling({ now: "2026-02-08T01:00:00Z" });

    expect(cancelled).toMatchObject({ success: true, data: { status: "cancelled" } });
    expect(run).toEqual({ success: true, data: { results: [] } });
    expect(s.charge).not.toHaveBeenCalled();
  });

  it("cancelBillingPlan fails when the rental has no live plan", async () => {
    const s = setup();

    const cancelled = await s.billing.cancelBillingPlan({ rentalId: "rental_1" });

    expect(cancelled).toMatchObject({
      success: false,
      error: { code: "billing_plan_not_found" },
    });
  });

  it("cancelling the rental cancels its plan", async () => {
    const s = setup();
    await s.checkout();

    // The fixture rental has no line items, so only the stored state is read.
    await s.rental.cancelRental({ rentalId: "rental_1" });

    expect(s.sqlite.prepare("select status from rentals").get()).toEqual({ status: "cancelled" });
    expect(await s.plan()).toMatchObject({ status: "cancelled" });
  });
});

describe("pure helpers", () => {
  it("dates each week from the start date", () => {
    expect(billingCycleStartsAt("2026-02-01", 1).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(billingCycleStartsAt("2026-02-01", 3).toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });

  it("bills a week only if it starts by the end date", () => {
    expect(isBillingCycleInRental({ startDate: "2026-02-01" }, 99)).toBe(true);
    expect(isBillingCycleInRental({ startDate: "2026-02-01", endDate: "2026-02-08" }, 2)).toBe(
      true,
    );
    expect(isBillingCycleInRental({ startDate: "2026-02-01", endDate: "2026-02-07" }, 2)).toBe(
      false,
    );
  });
});
