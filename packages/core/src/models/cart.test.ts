import { describe, expect, it } from "vite-plus/test";
import {
  cartLineError,
  cartQuantityError,
  isCartItemAvailable,
  maxCartLines,
  summarizeCart,
  type CartLine,
} from "./cart";

describe("summarizeCart", () => {
  it("prices only the available lines", () => {
    const summary = summarizeCart({
      currency: "USD",
      deliveryFee: 1000,
      items: [
        {
          productId: "prd_chair",
          name: "Chair",
          slug: "chair",
          images: [],
          quantity: 1,
          weeklyPrice: 6000,
          available: true,
        },
        {
          productId: "prd_desk",
          name: "Desk",
          slug: "desk",
          images: [],
          quantity: 1,
          weeklyPrice: 12000,
          available: false,
        },
      ],
    });

    expect(summary.weeklySubtotal).toBe(6000);
    expect(summary.totalDueToday).toBe(7000);
  });
});

describe("cartQuantityError", () => {
  it("accepts a whole number of units in range", () => {
    for (const quantity of [0, 1, 30]) {
      expect(cartQuantityError(quantity)).toBeNull();
    }
  });

  it("rejects anything else", () => {
    for (const quantity of [-1, 1.5, 31, Number.NaN]) {
      expect(cartQuantityError(quantity)).toBe("invalid_quantity");
    }
  });
});

describe("cartLineError", () => {
  const lines: CartLine[] = [{ productId: "prd_chair", quantity: 1 }];

  it("allows removing a line without checking stock or limits", () => {
    expect(cartLineError({ lines: [], productId: "prd_chair", quantity: 0, stock: 0 })).toBeNull();
  });

  it("refuses more units than the city has left", () => {
    expect(cartLineError({ lines: [], productId: "prd_desk", quantity: 4, stock: 3 })).toBe(
      "product_out_of_stock",
    );
  });

  it("refuses a new line once the cart is full", () => {
    const full = Array.from({ length: maxCartLines }, (_, index) => ({
      productId: `prd_${index}`,
      quantity: 1,
    }));

    expect(cartLineError({ lines: full, productId: "prd_new", quantity: 1, stock: null })).toBe(
      "cart_is_full",
    );

    expect(cartLineError({ lines: full, productId: "prd_0", quantity: 2, stock: null })).toBeNull();
  });

  it("checks the quantity before the cart state", () => {
    expect(cartLineError({ lines, productId: "prd_chair", quantity: 31, stock: 100 })).toBe(
      "invalid_quantity",
    );
  });
});

describe("isCartItemAvailable", () => {
  it("needs an active product that the city still prices", () => {
    expect(isCartItemAvailable("active", true)).toBe(true);
    expect(isCartItemAvailable("active", false)).toBe(false);
    expect(isCartItemAvailable("archived", true)).toBe(false);
  });
});
