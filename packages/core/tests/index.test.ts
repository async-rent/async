import { expect, test } from "vite-plus/test";
import { productSchema, rentalSchema } from "../src/index";

test("domain schemas are exported from the package root", () => {
  expect(productSchema).toBeDefined();
  expect(rentalSchema).toBeDefined();
});
