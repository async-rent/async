import { describe, it, expect } from "vite-plus/test";
import { isSetup } from "../src/catalog.js";

describe("Core catalog helpers", () => {
  it("should determine setup status correctly", () => {
    const product = { id: "p1", type: "setup" } as any;
    expect(isSetup(product)).toBe(true);
  });
});
