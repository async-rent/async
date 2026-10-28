import {
  billingAgreementStatusValues,
  billingAgreements,
  billingIntervalValues,
  cartItems,
  cartOwnerTypeValues,
  carts,
  fulfillmentStatusValues,
  liveBillingAgreementStatusValues,
  locationStatusValues,
  locations,
  paymentProviderValues,
  paymentStatusValues,
  payments,
  productStatusValues,
  products,
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
 * Asserts the exact SQL of a named check.
 *
 * The whole predicate is compared, so the guarded column, the operator and the
 * bound are pinned in one assertion: re-pointing a check at another column,
 * weakening a bound or appending a disjunction all change the rendered SQL
 * and fail here. The rendered SQL is the SQL the migration applies.
 */
function expectCheckSql(table: SQLiteTable, name: string, expected: string): void {
  expect(checkSqlOf(table, name)).toBe(expected);
}

/** The reference of a column, the way SQLite sees it. */
function columnRef(table: string, column: string): string {
  return `"${table}"."${column}"`;
}

/**
 * Asserts an enum check against the column it guards and the values it
 * accepts. A check bound to the wrong column or the wrong list fails here.
 */
function expectEnumCheck(
  table: SQLiteTable,
  name: string,
  column: string,
  values: readonly string[],
  options: { nullable?: boolean } = {},
): void {
  const list = values.map((value) => `'${value}'`).join(", ");
  const expected = options.nullable
    ? `${column} is null or ${column} in (${list})`
    : `${column} in (${list})`;

  expectCheckSql(table, name, expected);
}

/**
 * Asserts a numeric check against the column it guards and its bound.
 */
function expectNumericCheck(
  table: SQLiteTable,
  name: string,
  column: string,
  bound: "> 0" | ">= 0",
  options: { nullable?: boolean } = {},
): void {
  const expected = options.nullable
    ? `${column} is null or ${column} ${bound}`
    : `${column} ${bound}`;

  expectCheckSql(table, name, expected);
}

/**
 * Asserts a currency check against the column it guards.
 */
function expectCurrencyCheck(table: SQLiteTable, name: string, column: string): void {
  expectCheckSql(table, name, `length(${column}) = 3 and ${column} glob '[A-Z][A-Z][A-Z]'`);
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

  it("names the renter column provider-neutrally and optionally", () => {
    const user = getTableConfig(rentals).columns.find((column) => column.name === "user_id");

    expect(user).toBeDefined();
    // Identity is optional: a rental can still be placed as a guest.
    expect(user?.notNull).toBe(false);
  });

  it("keeps a user's rentals off a table scan", () => {
    expect(indexesOf(rentals)).toContainEqual(
      expect.objectContaining({
        name: "rentals_user_id_idx",
        unique: false,
        columns: ["user_id"],
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

  it("names its owner instead of a nullable customer column", () => {
    const columns = getTableConfig(carts).columns;

    const ownerType = columns.find((column) => column.name === "owner_type");
    const ownerId = columns.find((column) => column.name === "owner_id");

    expect(ownerType?.notNull).toBe(true);
    expect(ownerId?.notNull).toBe(true);
    expect(columns.map((column) => column.name)).not.toContain("customer_id");
  });

  it("holds no money of its own, so no total can drift from the catalog", () => {
    const columns = getTableConfig(carts).columns.map((column) => column.name);

    expect(columns).not.toContain("currency");
    expect(columns).not.toContain("weekly_subtotal");
    expect(columns).not.toContain("deposit");
    expect(columns).not.toContain("delivery_fee");
    expect(columns).not.toContain("discount");
    expect(columns).not.toContain("total_due_today");
    expect(columns).not.toContain("recurring_weekly");
  });

  it("gives every owner one cart per city", () => {
    expect(indexesOf(carts)).toContainEqual(
      expect.objectContaining({
        name: "carts_owner_location_unique",
        unique: true,
        columns: ["owner_type", "owner_id", "location_id"],
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

  it("holds one line per product, so the quantity is on the line", () => {
    expect(primaryKeysOf(cartItems)).toContainEqual(
      expect.objectContaining({
        name: "cart_items_pk",
        columns: ["cart_id", "product_id"],
      }),
    );

    const columns = getTableConfig(cartItems).columns.map((column) => column.name);
    expect(columns).not.toContain("position");
  });

  it("snapshots nothing, so a cart always shows today's prices", () => {
    const columns = getTableConfig(cartItems).columns.map((column) => column.name);

    expect(columns).not.toContain("name");
    expect(columns).not.toContain("slug");
    expect(columns).not.toContain("image_url");
    expect(columns).not.toContain("weekly_price");
    expect(columns).not.toContain("deposit");
  });

  it("rejects an invalid quantity", () => {
    expectNumericCheck(
      cartItems,
      "cart_items_quantity_check",
      columnRef("cart_items", "quantity"),
      "> 0",
    );
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
    expectNumericCheck(
      rentalItems,
      "rental_items_position_check",
      columnRef("rental_items", "position"),
      ">= 0",
    );
    expectNumericCheck(
      rentalItems,
      "rental_items_quantity_check",
      columnRef("rental_items", "quantity"),
      "> 0",
    );
    expectNumericCheck(
      rentalItems,
      "rental_items_weekly_price_check",
      columnRef("rental_items", "weekly_price"),
      ">= 0",
    );
    expectNumericCheck(
      rentalItems,
      "rental_items_deposit_check",
      columnRef("rental_items", "deposit"),
      ">= 0",
      { nullable: true },
    );
  });
});

describe("check constraints", () => {
  it("binds each rental check to its own column and enum values", () => {
    expectEnumCheck(
      rentals,
      "rentals_status_check",
      columnRef("rentals", "status"),
      rentalStatusValues,
    );
    expectEnumCheck(
      rentals,
      "rentals_fulfillment_status_check",
      columnRef("rentals", "fulfillment_status"),
      fulfillmentStatusValues,
      { nullable: true },
    );
    expectEnumCheck(
      rentals,
      "rentals_payment_status_snapshot_check",
      columnRef("rentals", "payment_status_snapshot"),
      paymentStatusValues,
      { nullable: true },
    );
  });

  it("binds each payment check to its own column and enum values", () => {
    expectEnumCheck(
      payments,
      "payments_provider_check",
      columnRef("payments", "provider"),
      paymentProviderValues,
    );
    expectEnumCheck(
      payments,
      "payments_status_check",
      columnRef("payments", "status"),
      paymentStatusValues,
    );
  });

  it("binds each billing agreement check to its own column and enum values", () => {
    expectEnumCheck(
      billingAgreements,
      "billing_agreements_provider_check",
      columnRef("billing_agreements", "provider"),
      paymentProviderValues,
    );
    expectEnumCheck(
      billingAgreements,
      "billing_agreements_interval_check",
      columnRef("billing_agreements", "interval"),
      billingIntervalValues,
    );
    expectEnumCheck(
      billingAgreements,
      "billing_agreements_status_check",
      columnRef("billing_agreements", "status"),
      billingAgreementStatusValues,
    );
  });

  it("binds each catalog enum check to its own column and enum values", () => {
    expectEnumCheck(
      products,
      "products_status_check",
      columnRef("products", "status"),
      productStatusValues,
    );
    expectEnumCheck(
      locations,
      "locations_status_check",
      columnRef("locations", "status"),
      locationStatusValues,
    );
  });

  it("pins the money checks of the rentals table", () => {
    expectCurrencyCheck(rentals, "rentals_currency_check", columnRef("rentals", "currency"));
    expectNumericCheck(
      rentals,
      "rentals_weekly_subtotal_check",
      columnRef("rentals", "weekly_subtotal"),
      ">= 0",
    );
    expectNumericCheck(rentals, "rentals_deposit_check", columnRef("rentals", "deposit"), ">= 0");
    expectNumericCheck(
      rentals,
      "rentals_delivery_fee_check",
      columnRef("rentals", "delivery_fee"),
      ">= 0",
    );
    expectNumericCheck(rentals, "rentals_discount_check", columnRef("rentals", "discount"), ">= 0");
    expectNumericCheck(
      rentals,
      "rentals_total_due_today_check",
      columnRef("rentals", "total_due_today"),
      ">= 0",
    );
  });

  it("pins the money checks of the locations table", () => {
    expectCurrencyCheck(locations, "locations_currency_check", columnRef("locations", "currency"));
    expectNumericCheck(
      locations,
      "locations_delivery_fee_check",
      columnRef("locations", "delivery_fee"),
      ">= 0",
    );
  });

  it("binds the cart's owner type to its own enum values", () => {
    expectEnumCheck(
      carts,
      "carts_owner_type_check",
      columnRef("carts", "owner_type"),
      cartOwnerTypeValues,
    );
  });

  it("pins the money checks of the payments table", () => {
    expectCurrencyCheck(payments, "payments_currency_check", columnRef("payments", "currency"));
    expectNumericCheck(
      payments,
      "payments_billing_cycle_check",
      columnRef("payments", "billing_cycle"),
      "> 0",
    );
    expectNumericCheck(payments, "payments_amount_check", columnRef("payments", "amount"), ">= 0");
  });

  it("pins the currency check of the billing agreements table", () => {
    expectCurrencyCheck(
      billingAgreements,
      "billing_agreements_currency_check",
      columnRef("billing_agreements", "currency"),
    );
  });
});
