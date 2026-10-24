import { readdirSync, readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";
import {
  categories,
  locations,
  productHighlights,
  productImages,
  productPrices,
  productSpecs,
  products,
} from "../src/schemas";

const catalogTables = [
  locations,
  categories,
  products,
  productImages,
  productHighlights,
  productSpecs,
  productPrices,
];

const tableNames = catalogTables.map((table) => getTableConfig(table).name);

function configOf(table: (typeof catalogTables)[number]) {
  return getTableConfig(table);
}

function columnNames(table: (typeof catalogTables)[number]) {
  return configOf(table).columns.map((column) => column.name);
}

function primaryKeyColumns(table: (typeof catalogTables)[number]) {
  return configOf(table).primaryKeys.flatMap((key) => key.columns.map((column) => column.name));
}

describe("catalog schema", () => {
  it("defines a table for each catalog entity plus its nested rows", () => {
    expect(tableNames).toEqual([
      "locations",
      "categories",
      "products",
      "product_images",
      "product_highlights",
      "product_specs",
      "product_prices",
    ]);
  });

  it("stores every location field the domain shape exposes", () => {
    expect(columnNames(locations)).toEqual([
      "id",
      "slug",
      "name",
      "country",
      "timezone",
      "description",
      "status",
      "created_at",
      "updated_at",
    ]);

    expect(configOf(locations).checks.map((check) => check.name)).toContain(
      "locations_status_check",
    );
  });

  it("stores every category field and keeps slugs unique", () => {
    expect(columnNames(categories)).toEqual([
      "id",
      "slug",
      "name",
      "description",
      "sort_order",
      "created_at",
      "updated_at",
    ]);

    const slugColumn = configOf(categories).columns.find((column) => column.name === "slug");
    expect(slugColumn?.isUnique).toBe(true);
    expect(slugColumn?.uniqueName).toBe("categories_slug_unique");
  });

  it("stores every product field, including badge and merchandising flags", () => {
    expect(columnNames(products)).toEqual([
      "id",
      "slug",
      "name",
      "tagline",
      "description",
      "category_id",
      "badge",
      "featured",
      "status",
      "created_at",
      "updated_at",
    ]);

    expect(configOf(products).checks.map((check) => check.name)).toContain("products_status_check");
  });

  it("references categories with restrict on delete and cascade on update", () => {
    const [categoryReference] = configOf(products).foreignKeys;

    expect(categoryReference?.reference().foreignTable).toBe(categories);
    expect(categoryReference?.onDelete).toBe("restrict");
    expect(categoryReference?.onUpdate).toBe("cascade");
  });

  it("keeps ordered child rows unique per product", () => {
    expect(primaryKeyColumns(productImages)).toEqual(["product_id", "position"]);
    expect(primaryKeyColumns(productHighlights)).toEqual(["product_id", "position"]);
    expect(primaryKeyColumns(productSpecs)).toEqual(["product_id", "position"]);

    for (const table of [productImages, productHighlights, productSpecs]) {
      expect(configOf(table).foreignKeys[0]?.onDelete).toBe("cascade");
    }
  });

  it("allows one price per product and city, with cascade on product deletes", () => {
    expect(columnNames(productPrices)).toEqual([
      "product_id",
      "location_id",
      "currency",
      "weekly_price",
      "deposit",
      "delivery_fee",
      "stock",
      "created_at",
      "updated_at",
    ]);
    expect(primaryKeyColumns(productPrices)).toEqual(["product_id", "location_id"]);

    const [productReference, locationReference] = configOf(productPrices).foreignKeys;
    expect(productReference?.onDelete).toBe("cascade");
    expect(locationReference?.reference().foreignTable).toBe(locations);
    expect(locationReference?.onDelete).toBe("restrict");
  });

  it("has a generated migration that creates every table", () => {
    const migrationsDirectory = new URL("../migrations/", import.meta.url);
    const sql = readdirSync(migrationsDirectory)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(new URL(file, migrationsDirectory), "utf8"))
      .join("\n");

    for (const tableName of tableNames) {
      expect(sql).toContain(`CREATE TABLE \`${tableName}\``);
    }
  });
});
