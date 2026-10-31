import { describe, expect, it } from "vite-plus/test";
import {
  cancellableRentalStatusValues,
  generateRentalNumber,
  isRentalCancellable,
  rentalNumberSchema,
} from "./rental";

describe("generateRentalNumber", () => {
  it("produces a number that matches the rental number schema", () => {
    const number = generateRentalNumber(new Date(Date.UTC(2026, 5, 15)), () => 0);

    expect(number.startsWith("AR-2026-")).toBe(true);
    expect(rentalNumberSchema.safeParse(number).success).toBe(true);
  });

  it("draws every suffix character from the unambiguous alphabet", () => {
    // Walk the alphabet one step per draw: the suffix must never land on 0/O/1/I,
    // which the schema's character class rejects.
    const stepped = (size: number) => {
      const draws = Array.from({ length: size }, (_, index) => index / 32);
      let next = 0;

      return () => draws[next++] ?? 0;
    };

    const number = generateRentalNumber(new Date(Date.UTC(2026, 0, 1)), stepped(6));

    expect(rentalNumberSchema.safeParse(number).success).toBe(true);
  });

  it("varies the suffix with the random source", () => {
    const low = generateRentalNumber(new Date(Date.UTC(2026, 0, 1)), () => 0);
    const high = generateRentalNumber(new Date(Date.UTC(2026, 0, 1)), () => 0.99);

    expect(low).not.toBe(high);
  });
});

describe("isRentalCancellable", () => {
  it("allows cancelling a live rental", () => {
    for (const status of cancellableRentalStatusValues) {
      expect(isRentalCancellable(status)).toBe(true);
    }
  });

  it("refuses a terminal rental", () => {
    expect(isRentalCancellable("completed")).toBe(false);
    expect(isRentalCancellable("cancelled")).toBe(false);
  });
});
