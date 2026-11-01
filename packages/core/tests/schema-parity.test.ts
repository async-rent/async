import {
  billingAgreementStatusValues,
  billingIntervalValues,
  fulfillmentStatusValues,
  locationStatusValues,
  paymentProviderValues,
  paymentStatusValues,
  productStatusValues,
  rentalStatusValues,
} from "@async-rent/db";
import { describe, expect, it } from "vite-plus/test";
import {
  billingAgreementStatusSchema,
  billingIntervalSchema,
  fulfillmentStatusSchema,
  locationStatusSchema,
  paymentProviderSchema,
  paymentStatusSchema,
  productStatusSchema,
  rentalStatusSchema,
} from "../src/schemas";

/**
 * The database stores statuses as text columns with check constraints, because
 * `packages/db` cannot import these zod enums (core depends on db). These tests
 * make the duplicated literals fail loudly the moment one side changes.
 */
describe("db enum values", () => {
  it("match rentalStatusSchema", () => {
    expect(rentalStatusValues).toEqual(rentalStatusSchema.options);
  });

  it("match fulfillmentStatusSchema", () => {
    expect(fulfillmentStatusValues).toEqual(fulfillmentStatusSchema.options);
  });

  it("match locationStatusSchema", () => {
    expect(locationStatusValues).toEqual(locationStatusSchema.options);
  });

  it("match productStatusSchema", () => {
    expect(productStatusValues).toEqual(productStatusSchema.options);
  });

  it("match paymentStatusSchema", () => {
    expect(paymentStatusValues).toEqual(paymentStatusSchema.options);
  });

  it("match paymentProviderSchema", () => {
    expect(paymentProviderValues).toEqual(paymentProviderSchema.options);
  });

  it("match billingAgreementStatusSchema", () => {
    expect(billingAgreementStatusValues).toEqual(billingAgreementStatusSchema.options);
  });

  it("match billingIntervalSchema", () => {
    expect(billingIntervalValues).toEqual(billingIntervalSchema.options);
  });
});
