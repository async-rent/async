import {
  billingAgreementStatusValues,
  billingAgreements,
  billingIntervalValues,
  cartItems,
  carts,
  fulfillmentStatusValues,
  liveBillingAgreementStatusValues,
  paymentProviderValues,
  paymentStatusValues,
  payments,
  rentalItems,
  rentals,
  rentalStatusValues,
} from "@async-rent/db";
import { getTableName } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";

/**
 * The constraint contract of the cart, line item, rental, payment and billing
 * tables.
 *
 * The database is the only place these guarantees live, so they are asserted
 * here rather than left to a later migration to drop by accident. Core owns
 * these assertions because core is the only package that may query the
 * schema.
 */

const dialect = new SQLiteSyncDialect();

interface IndexSummary {
  name: string;
  unique: boolean;
  columns: string[];
  where: string;
}

interface ForeignKeySummary {
  name: string;
  columns: string[];
  referenceTable: string;
  referenceColumns: string[];
  onDelete: string;
}

function columnNames(columns: readonly unknown[]): string[] {
  return columns.map((column) => (column as { name: string }).name);
}

function indexesOf(table: SQLiteTable): IndexSummary[] {
  return getTableConfig(table).indexes.map((index) => ({
    name: index.config.name ?? "",
    unique: index.config.unique ?? false,
    columns: columnNames(index.config.columns),
    where: index.config.where ? dialect.sqlToQuery(index.config.where).sql : "",
  }));
}

function foreignKeysOf(table: SQLiteTable): ForeignKeySummary[] {
  return getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();

    return {
      name: foreignKey.getName(),
      columns: columnNames(reference.columns),
      referenceTable: getTableName(reference.foreignTable),
      referenceColumns: columnNames(reference.foreignColumns),
      onDelete: foreignKey.onDelete ?? "",
    };
  });
}

function checkSqlOf(table: SQLiteTable, name: string): string {
  const found = getTableConfig(table).checks.find((check) => check.name === name);

  if (!found) throw new Error(`No check named ${name}`);

  return dialect.sqlToQuery(found.value as SQL).sql;
}

/**
 * Asserts each named check against the fragments that make up its
 * predicate, so weakening or dropping a bound fails the test.
 */
function expectCheckPredicates(table: SQLiteTable, predicates: [string, string[]][]): void {
  for (const [name, bounds] of predicates) {
    const rendered = checkSqlOf(table, name);

    for (const bound of bounds) expect(rendered).toContain(bound);
  }
}

function primaryKeysOf(table: SQLiteTable): { name: string; columns: string[] }[] {
  return getTableConfig(table).primaryKeys.map((primaryKey) => ({
    name: primaryKey.getName(),
    columns: columnNames(primaryKey.columns),
  }));
}

describe("payments table", () => {
  it("identifies a provider order and a provider capture uniquely", () => {
    const indexes = indexesOf(payments);

    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: "payments_provider_external_order_id_unique",
        unique: true,
        columns: ["provider", "external_order_id"],
      }),
    );
    expect(indexes).toContainEqual(
      expect.objectContaining({
        name: "payments_provider_external_payment_id_unique",
        unique: true,
        columns: ["provider", "external_payment_id"],
      }),
    );
  });

  it("settles a rental cycle at most once", () => {
    expect(indexesOf(payments)).toContainEqual(
      expect.objectContaining({
        name: "payments_rental_id_billing_cycle_unique",
        unique: true,
        columns: ["rental_id", "billing_cycle"],
      }),
    );
  });

  it("binds the agreement to the payment's own rental", () => {
    expect(foreignKeysOf(payments)).toContainEqual(
      expect.objectContaining({
        name: "payments_billing_agreement_rental_fk",
        columns: ["billing_agreement_id", "rental_id"],
        referenceTable: "billing_agreements",
        referenceColumns: ["id", "rental_id"],
        onDelete: "restrict",
      }),
    );
  });

  it("keeps agreement lookups off a table scan", () => {
    expect(indexesOf(payments)).toContainEqual(
      expect.objectContaining({
        name: "payments_billing_agreement_id_idx",
        unique: false,
        columns: ["billing_agreement_id"],
      }),
    );
  });

  it("keeps money history when a rental is deleted", () => {
    const rentalReference = foreignKeysOf(payments).find(
      (foreignKey) => foreignKey.columns.join() === "rental_id",
    );

    expect(rentalReference?.onDelete).toBe("restrict");
  });
});

describe("billing agreements table", () => {
  it("allows one live agreement per rental", () => {
    const index = indexesOf(billingAgreements).find(
      (candidate) => candidate.name === "billing_agreements_rental_id_live_unique",
    );

    expect(index?.unique).toBe(true);
    expect(index?.columns).toEqual(["rental_id"]);

    // The rendered WHERE clause is built from `liveBillingAgreementStatusValues`,
    // so a status cannot become "live" without moving through that list.
    const where = index?.where ?? "";
    const live = new Set<string>(liveBillingAgreementStatusValues);

    for (const status of liveBillingAgreementStatusValues) {
      expect(where).toContain(`'${status}'`);
    }
    for (const status of billingAgreementStatusValues) {
      if (!live.has(status)) {
        expect(where).not.toContain(`'${status}'`);
      }
    }
  });

  it("serves a rental-scoped agreement read whatever the statuses", () => {
    expect(indexesOf(billingAgreements)).toContainEqual(
      expect.objectContaining({
        name: "billing_agreements_rental_id_idx",
        unique: false,
        columns: ["rental_id"],
      }),
    );
  });

  it("exposes the parent key the payment composite foreign key needs", () => {
    expect(indexesOf(billingAgreements)).toContainEqual(
      expect.objectContaining({
        name: "billing_agreements_id_rental_id_unique",
        unique: true,
        columns: ["id", "rental_id"],
      }),
    );
  });

  it("keeps the provider mandate when a rental is deleted", () => {
    const rentalReference = foreignKeysOf(billingAgreements).find(
      (foreignKey) => foreignKey.columns.join() === "rental_id",
    );

    expect(rentalReference?.onDelete).toBe("restrict");
  });
});

describe("rentals table", () => {
  it("has no denormalized agreement pointer", () => {
    const columns = getTableConfig(rentals).columns.map((column) => column.name);

    expect(columns).not.toContain("billing_agreement_id");
  });

  it("points at the location primary key", () => {
    expect(foreignKeysOf(rentals)).toContainEqual(
      expect.objectContaining({
        columns: ["location_id"],
        referenceTable: "locations",
        referenceColumns: ["id"],
      }),
    );
  });

  it("rejects a duplicate order number", () => {
    const number = getTableConfig(rentals).columns.find((column) => column.name === "number");

    expect(number?.isUnique).toBe(true);
  });
});

describe("carts table", () => {
  it("points at the location primary key", () => {
    expect(foreignKeysOf(carts)).toContainEqual(
      expect.objectContaining({
        columns: ["location_id"],
        referenceTable: "locations",
        referenceColumns: ["id"],
      }),
    );
  });
});

describe("cart items table", () => {
  it("belongs to its cart", () => {
    expect(foreignKeysOf(cartItems)).toContainEqual(
      expect.objectContaining({
        columns: ["cart_id"],
        referenceTable: "carts",
        referenceColumns: ["id"],
        onDelete: "cascade",
      }),
    );
  });

  it("points at the product primary key", () => {
    expect(foreignKeysOf(cartItems)).toContainEqual(
      expect.objectContaining({
        columns: ["product_id"],
        referenceTable: "products",
        referenceColumns: ["id"],
        onDelete: "restrict",
      }),
    );
  });

  it("orders lines by position within the cart", () => {
    expect(primaryKeysOf(cartItems)).toContainEqual(
      expect.objectContaining({
        name: "cart_items_pk",
        columns: ["cart_id", "position"],
      }),
    );
  });

  it("rejects an invalid position, quantity, price or deposit", () => {
    expectCheckPredicates(cartItems, [
      ["cart_items_position_check", [">= 0"]],
      ["cart_items_quantity_check", ["> 0"]],
      ["cart_items_weekly_price_check", [">= 0"]],
      ["cart_items_deposit_check", ["is null", ">= 0"]],
    ]);
  });
});

describe("rental items table", () => {
  it("belongs to its rental", () => {
    expect(foreignKeysOf(rentalItems)).toContainEqual(
      expect.objectContaining({
        columns: ["rental_id"],
        referenceTable: "rentals",
        referenceColumns: ["id"],
        onDelete: "cascade",
      }),
    );
  });

  it("points at the product primary key", () => {
    expect(foreignKeysOf(rentalItems)).toContainEqual(
      expect.objectContaining({
        columns: ["product_id"],
        referenceTable: "products",
        referenceColumns: ["id"],
        onDelete: "restrict",
      }),
    );
  });

  it("orders lines by position within the rental", () => {
    expect(primaryKeysOf(rentalItems)).toContainEqual(
      expect.objectContaining({
        name: "rental_items_pk",
        columns: ["rental_id", "position"],
      }),
    );
  });

  it("rejects an invalid position, quantity, price or deposit", () => {
    expectCheckPredicates(rentalItems, [
      ["rental_items_position_check", [">= 0"]],
      ["rental_items_quantity_check", ["> 0"]],
      ["rental_items_weekly_price_check", [">= 0"]],
      ["rental_items_deposit_check", ["is null", ">= 0"]],
    ]);
  });
});

describe("check constraints", () => {
  /**
   * Asserts a single named check against a single enum list. A check bound to
   * the wrong list fails here, where a table-wide string match would not.
   */
  function expectEnumCheck(table: SQLiteTable, name: string, values: readonly string[]): void {
    const rendered = checkSqlOf(table, name);

    for (const value of values) expect(rendered).toContain(`'${value}'`);
  }

  it("binds each rental check to its own enum values", () => {
    expectEnumCheck(rentals, "rentals_status_check", rentalStatusValues);
    expectEnumCheck(rentals, "rentals_fulfillment_status_check", fulfillmentStatusValues);
    expectEnumCheck(rentals, "rentals_payment_status_snapshot_check", paymentStatusValues());
  });

  it("binds each payment check to its own enum values", () => {
    expectEnumCheck(payments, "payments_provider_check", paymentProviderValues());
    expectEnumCheck(payments, "payments_status_check", paymentStatusValues());
  });

  it("binds each billing agreement check to its own enum values", () => {
    expectEnumCheck(
      billingAgreements,
      "billing_agreements_provider_check",
      paymentProviderValues(),
    );
    expectEnumCheck(billingAgreements, "billing_agreements_interval_check", billingIntervalValues);
    expectEnumCheck(
      billingAgreements,
      "billing_agreements_status_check",
      billingAgreementStatusValues,
    );
  });

  it("pins the numeric and currency checks of the carts table", () => {
    expectCheckPredicates(carts, [
      ["carts_currency_check", ["length(", "= 3", "glob '[A-Z][A-Z][A-Z]'"]],
      ["carts_weekly_subtotal_check", [">= 0"]],
      ["carts_deposit_check", [">= 0"]],
      ["carts_delivery_fee_check", [">= 0"]],
      ["carts_discount_check", [">= 0"]],
      ["carts_total_due_today_check", [">= 0"]],
      ["carts_recurring_weekly_check", [">= 0"]],
    ]);
  });

  it("pins the numeric and currency checks of the rentals table", () => {
    expectCheckPredicates(rentals, [
      ["rentals_currency_check", ["length(", "= 3", "glob '[A-Z][A-Z][A-Z]'"]],
      ["rentals_weekly_subtotal_check", [">= 0"]],
      ["rentals_deposit_check", [">= 0"]],
      ["rentals_delivery_fee_check", [">= 0"]],
      ["rentals_discount_check", [">= 0"]],
      ["rentals_total_due_today_check", [">= 0"]],
      ["rentals_recurring_weekly_check", [">= 0"]],
    ]);
  });

  it("pins the numeric and currency checks of the payments table", () => {
    expectCheckPredicates(payments, [
      ["payments_billing_cycle_check", ["> 0"]],
      ["payments_currency_check", ["length(", "= 3", "glob '[A-Z][A-Z][A-Z]'"]],
      ["payments_amount_check", [">= 0"]],
    ]);
  });

  it("pins the currency check of the billing agreements table", () => {
    expectCheckPredicates(billingAgreements, [
      ["billing_agreements_currency_check", ["length(", "= 3", "glob '[A-Z][A-Z][A-Z]'"]],
    ]);
  });
});
