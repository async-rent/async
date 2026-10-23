import { expect, test } from "vite-plus/test";
import { paymentSchema, productSchema, quoteCart, rentalSchema, searchCatalog } from "../src/index";

test("domain schemas and catalog helpers are exported from the package root", () => {
  expect(productSchema).toBeDefined();
  expect(rentalSchema).toBeDefined();
  expect(paymentSchema).toBeDefined();
  expect(searchCatalog).toBeDefined();
  expect(quoteCart).toBeDefined();
});
