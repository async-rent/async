import {
  billingAgreements,
  billingAgreementStatusValues,
  carts,
  fulfillmentStatusValues,
  paymentProviderValues,
  paymentStatusValues,
  payments,
  rentals,
  rentalStatusValues,
} from "@async-rent/db";
import { getTableName } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";

/**
 * The constraint contract of the cart, rental, payment and billing tables.
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

function checkSqlOf(table: SQLiteTable): string {
  return getTableConfig(table)
    .checks.map((check) => dialect.sqlToQuery(check.value as SQL).sql)
    .join("\n");
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
    expect(index?.where).toContain("'active'");
    expect(index?.where).toContain("'paused'");
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

describe("check constraints", () => {
  it("derive the rental statuses from the shared enum values", () => {
    const checks = checkSqlOf(rentals);

    for (const status of rentalStatusValues) expect(checks).toContain(`'${status}'`);
    for (const status of fulfillmentStatusValues) expect(checks).toContain(`'${status}'`);
    for (const status of paymentStatusValues) expect(checks).toContain(`'${status}'`);
  });

  it("derive the payment and billing statuses from the shared enum values", () => {
    const paymentChecks = checkSqlOf(payments);

    for (const status of paymentStatusValues) expect(paymentChecks).toContain(`'${status}'`);
    for (const provider of paymentProviderValues) expect(paymentChecks).toContain(`'${provider}'`);

    const billingChecks = checkSqlOf(billingAgreements);

    for (const status of billingAgreementStatusValues)
      expect(billingChecks).toContain(`'${status}'`);
  });
});
