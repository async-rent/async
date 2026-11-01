import { describe, expect, it, vi } from "vite-plus/test";
import { createTestDatabase } from "../../tests/database";
import { createPaymentService } from "./payment";
import type { CaptureOutcome, PaymentProviderAdapter } from "./payment";

const urls = { returnUrl: "https://async.rent/paid", cancelUrl: "https://async.rent/cart" };
const approvalUrl = "https://pay.example.com/approve";

function setup() {
  const database = createTestDatabase();

  database.sqlite.exec(`
    INSERT INTO locations (id, slug, name, country, timezone, currency, delivery_fee, status)
      VALUES ('loc_bali', 'bali', 'Bali', 'Indonesia', 'Asia/Makassar', 'USD', 1000, 'active');

    INSERT INTO rentals (id, number, contact_name, contact_email, address_line1, address_city,
      address_country_code, location_id, currency, start_date, status, weekly_subtotal, deposit,
      delivery_fee, discount, total_due_today)
    VALUES
      ('rental_1', 'AR-2026-AAAAAA', 'Ada', 'ada@example.com', '1 Jalan', 'Ubud', 'ID', 'loc_bali',
        'USD', '2026-02-01', 'pending_payment', 12000, 24000, 1000, 0, 37000),
      ('rental_cancelled', 'AR-2026-BBBBBB', 'Ada', 'ada@example.com', '1 Jalan', 'Ubud', 'ID',
        'loc_bali', 'USD', '2026-02-01', 'cancelled', 12000, 0, 1000, 0, 13000);
  `);

  let orders = 0;

  const createOrder = vi.fn<PaymentProviderAdapter["createOrder"]>(async () => {
    orders += 1;

    return { externalOrderId: `order_${orders}`, approvalUrl };
  });
  const captureOrder = vi.fn<PaymentProviderAdapter["captureOrder"]>(
    async ({ externalOrderId }): Promise<CaptureOutcome> => ({
      status: "succeeded",
      externalPaymentId: `capture_${externalOrderId}`,
    }),
  );
  const refund = vi.fn<PaymentProviderAdapter["refund"]>(async () => {});

  const service = createPaymentService({
    db: database.db,
    providers: { paypal: { createOrder, captureOrder, refund } },
  });

  const rentalRow = (id: string) =>
    database.sqlite
      .prepare("select status, payment_status_snapshot as paymentStatus from rentals where id = ?")
      .get(id);

  const paymentCount = () =>
    database.sqlite.prepare("select count(*) as total from payments").get();

  return { ...database, service, createOrder, captureOrder, refund, rentalRow, paymentCount };
}

type Setup = ReturnType<typeof setup>;

// Starts the first payment for `rental_1` and returns the provider's order id.
async function start(s: Setup): Promise<string> {
  const started = await s.service.startPayment({
    rentalId: "rental_1",
    provider: "paypal",
    ...urls,
  });
  if (!started.success) throw new Error(started.error.message);

  return started.data.payment.externalOrderId;
}

// Starts and confirms the first payment, returning its id.
async function pay(s: Setup): Promise<string> {
  const externalOrderId = await start(s);
  const confirmed = await s.service.confirmPayment({ provider: "paypal", externalOrderId });
  if (!confirmed.success) throw new Error(confirmed.error.message);

  return confirmed.data.id;
}

describe("startPayment", () => {
  it("prepares the first cycle at the amount due today and returns the approval link", async () => {
    const s = setup();

    const result = await s.service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        approvalUrl,
        payment: {
          rentalId: "rental_1",
          provider: "paypal",
          externalOrderId: "order_1",
          billingCycle: 1,
          amount: 37000,
          currency: "USD",
          status: "pending",
        },
      },
    });
    expect(s.createOrder).toHaveBeenCalledWith({
      reference: "AR-2026-AAAAAA",
      amount: 37000,
      currency: "USD",
      ...urls,
    });
  });

  it("fails when the provider is not configured", async () => {
    const s = setup();
    const service = createPaymentService({ db: s.db, providers: {} });

    const result = await service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(result).toMatchObject({ success: false, error: { code: "provider_not_configured" } });
  });

  it("fails for an unknown rental", async () => {
    const s = setup();

    const result = await s.service.startPayment({ rentalId: "nope", provider: "paypal", ...urls });

    expect(result).toMatchObject({ success: false, error: { code: "rental_not_found" } });
    expect(s.createOrder).not.toHaveBeenCalled();
  });

  it("refuses a rental that is not awaiting payment", async () => {
    const s = setup();

    const result = await s.service.startPayment({
      rentalId: "rental_cancelled",
      provider: "paypal",
      ...urls,
    });

    expect(result).toMatchObject({ success: false, error: { code: "rental_not_payable" } });
    expect(s.createOrder).not.toHaveBeenCalled();
  });

  it("keeps no payment when the provider fails", async () => {
    const s = setup();
    s.createOrder.mockRejectedValueOnce(new Error("provider down"));

    const result = await s.service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(result).toMatchObject({ success: false, error: { code: "provider_request_failed" } });
    expect(s.paymentCount()).toEqual({ total: 0 });
  });

  it("opens a fresh order on the same row when the customer abandoned the first", async () => {
    const s = setup();
    const first = await start(s);

    const second = await s.service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(first).toBe("order_1");
    expect(second).toMatchObject({
      success: true,
      data: { payment: { externalOrderId: "order_2", status: "pending" } },
    });
    expect(s.paymentCount()).toEqual({ total: 1 });
  });

  it("refuses to start again once the payment is settled", async () => {
    const s = setup();
    await pay(s);
    s.sqlite.exec("update rentals set status = 'pending_payment' where id = 'rental_1'");

    const result = await s.service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(result).toMatchObject({ success: false, error: { code: "payment_already_started" } });
  });
});

describe("confirmPayment", () => {
  it("captures the order, marks it paid and confirms the rental", async () => {
    const s = setup();
    const externalOrderId = await start(s);

    const result = await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    expect(result).toMatchObject({
      success: true,
      data: {
        status: "succeeded",
        externalPaymentId: "capture_order_1",
        paidAt: expect.any(String),
      },
    });
    expect(s.rentalRow("rental_1")).toEqual({ status: "confirmed", paymentStatus: "succeeded" });
  });

  it("records a declined charge with its reason and leaves the rental unpaid", async () => {
    const s = setup();
    const externalOrderId = await start(s);
    s.captureOrder.mockResolvedValueOnce({
      status: "failed",
      failureReason: "INSTRUMENT_DECLINED",
    });

    const result = await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    expect(result).toMatchObject({
      success: true,
      data: { status: "failed", failureReason: "INSTRUMENT_DECLINED", paidAt: undefined },
    });
    expect(s.rentalRow("rental_1")).toEqual({
      status: "pending_payment",
      paymentStatus: "failed",
    });
  });

  it("lets the customer try again after a decline", async () => {
    const s = setup();
    const externalOrderId = await start(s);
    s.captureOrder.mockResolvedValueOnce({
      status: "failed",
      failureReason: "INSTRUMENT_DECLINED",
    });
    await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    const retry = await s.service.startPayment({
      rentalId: "rental_1",
      provider: "paypal",
      ...urls,
    });

    expect(retry).toMatchObject({
      success: true,
      data: { payment: { status: "pending", failureReason: undefined } },
    });
  });

  it("returns the settled payment on a replayed callback without capturing again", async () => {
    const s = setup();
    const externalOrderId = await start(s);
    await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    const replay = await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    expect(replay).toMatchObject({ success: true, data: { status: "succeeded" } });
    expect(s.captureOrder).toHaveBeenCalledTimes(1);
  });

  it("fails for an unknown order", async () => {
    const s = setup();

    const result = await s.service.confirmPayment({ provider: "paypal", externalOrderId: "nope" });

    expect(result).toMatchObject({ success: false, error: { code: "payment_not_found" } });
  });

  it("fails when the provider is not configured", async () => {
    const s = setup();
    const service = createPaymentService({ db: s.db, providers: {} });

    const result = await service.confirmPayment({ provider: "paypal", externalOrderId: "order_1" });

    expect(result).toMatchObject({ success: false, error: { code: "provider_not_configured" } });
  });

  it("leaves the payment pending when the provider cannot be reached", async () => {
    const s = setup();
    const externalOrderId = await start(s);
    s.captureOrder.mockRejectedValueOnce(new Error("provider down"));

    const result = await s.service.confirmPayment({ provider: "paypal", externalOrderId });
    const retry = await s.service.confirmPayment({ provider: "paypal", externalOrderId });

    expect(result).toMatchObject({ success: false, error: { code: "provider_request_failed" } });
    expect(retry).toMatchObject({ success: true, data: { status: "succeeded" } });
  });
});

describe("refundPayment", () => {
  it("refunds a paid charge in full and records it on the rental", async () => {
    const s = setup();
    const paymentId = await pay(s);

    const result = await s.service.refundPayment({ paymentId });

    expect(result).toMatchObject({ success: true, data: { id: paymentId, status: "refunded" } });
    expect(s.refund).toHaveBeenCalledWith({
      externalPaymentId: "capture_order_1",
      amount: 37000,
      currency: "USD",
    });
    expect(s.rentalRow("rental_1")).toEqual({ status: "confirmed", paymentStatus: "refunded" });
  });

  it("fails for an unknown payment", async () => {
    const s = setup();

    const result = await s.service.refundPayment({ paymentId: "nope" });

    expect(result).toMatchObject({ success: false, error: { code: "payment_not_found" } });
  });

  it("refuses a payment that has not succeeded", async () => {
    const s = setup();
    await start(s);
    const [{ id }] = s.sqlite.prepare("select id from payments").all() as { id: string }[];

    const result = await s.service.refundPayment({ paymentId: id });

    expect(result).toMatchObject({ success: false, error: { code: "payment_not_refundable" } });
    expect(s.refund).not.toHaveBeenCalled();
  });

  it("refuses to refund twice", async () => {
    const s = setup();
    const paymentId = await pay(s);
    await s.service.refundPayment({ paymentId });

    const result = await s.service.refundPayment({ paymentId });

    expect(result).toMatchObject({ success: false, error: { code: "payment_not_refundable" } });
    expect(s.refund).toHaveBeenCalledTimes(1);
  });

  it("keeps the payment paid when the provider fails to refund", async () => {
    const s = setup();
    const paymentId = await pay(s);
    s.refund.mockRejectedValueOnce(new Error("provider down"));

    const result = await s.service.refundPayment({ paymentId });

    expect(result).toMatchObject({ success: false, error: { code: "provider_request_failed" } });
    expect(s.rentalRow("rental_1")).toEqual({ status: "confirmed", paymentStatus: "succeeded" });
  });
});

describe("listPayments", () => {
  it("returns an empty history for a rental with no charges", async () => {
    const s = setup();

    const result = await s.service.listPayments({ rentalId: "rental_1" });

    expect(result).toEqual({ success: true, data: [] });
  });

  it("returns every charge, oldest cycle first, whatever its status", async () => {
    const s = setup();
    await pay(s);
    s.sqlite.exec(`
      INSERT INTO payments (id, rental_id, billing_cycle, provider, external_order_id, amount,
        currency, status, failure_reason)
      VALUES ('pay_2', 'rental_1', 2, 'paypal', 'order_cycle_2', 12000, 'USD', 'failed', 'EXPIRED');
    `);

    const result = await s.service.listPayments({ rentalId: "rental_1" });

    expect(result).toMatchObject({
      success: true,
      data: [
        { billingCycle: 1, status: "succeeded" },
        { billingCycle: 2, status: "failed", failureReason: "EXPIRED" },
      ],
    });
  });

  it("does not include another rental's charges", async () => {
    const s = setup();
    await pay(s);

    const result = await s.service.listPayments({ rentalId: "rental_cancelled" });

    expect(result).toEqual({ success: true, data: [] });
  });
});
