import { describe, expect, it } from "vite-plus/test";
import { priceLines } from "./pricing";

describe("priceLines", () => {
  it("sums weekly prices and deposits per unit", () => {
    expect(
      priceLines({
        currency: "USD",
        deliveryFee: 1000,
        lines: [
          { weeklyPrice: 12000, deposit: 24000, quantity: 2 },
          { weeklyPrice: 4000, quantity: 1 },
        ],
      }),
    ).toEqual({
      currency: "USD",
      weeklySubtotal: 28000,
      deposit: 48000,
      deliveryFee: 1000,
      discount: 0,
      totalDueToday: 77000,
    });
  });

  it("charges delivery once for the order and only when it has lines", () => {
    expect(
      priceLines({
        currency: "USD",
        deliveryFee: 1000,
        lines: [{ weeklyPrice: 5000, quantity: 3 }],
      }).deliveryFee,
    ).toBe(1000);

    expect(priceLines({ currency: "USD", deliveryFee: 1000, lines: [] })).toEqual({
      currency: "USD",
      weeklySubtotal: 0,
      deposit: 0,
      deliveryFee: 0,
      discount: 0,
      totalDueToday: 0,
    });
  });

  it("subtracts the discount from the amount due today", () => {
    const summary = priceLines({
      currency: "USD",
      deliveryFee: 1000,
      discount: 500,
      lines: [{ weeklyPrice: 5000, quantity: 1 }],
    });

    expect(summary.totalDueToday).toBe(5500);
  });
});
