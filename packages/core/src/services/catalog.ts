import { z } from "zod";
import { DrizzleD1Database } from "drizzle-orm/d1";
import type { Product } from "../types";
import { createResult } from "../utils";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

export interface CreateCatalogServiceOptions {
  db: DrizzleD1Database;
}

export function createCatalogService({ db }: CreateCatalogServiceOptions) {
  const createProductResult = createResult(
    z.void(),
    z.enum([
      "product_already_exists",
      "product_slug_already_exists",
      "failed_to_fetch_product",
      "failed_to_save_product",
    ]),
  );
  async function createProduct(
    product: Product,
  ): Promise<z.infer<(typeof createProductResult)["schema"]>> {
    const { success, failed } = createProductResult;

    const existingProducts = await db
      .select()
      .from({} as SQLiteTable)
      .catch(() => null);
    if (!existingProducts) return failed("failed_to_fetch_product", "Failed to fetch product");

    const [existingProduct] = existingProducts;
    if (existingProduct && existingProduct.id === product.id)
      return failed("product_already_exists", `Product with id ${product.id} already exists`);
    if (existingProduct && existingProduct.slug === product.slug)
      return failed(
        "product_slug_already_exists",
        `Product with slug ${product.slug} already exists`,
      );

    const saveProduct = await db
      .insert({} as SQLiteTable)
      .values({})
      .returning({})
      .catch(() => null);
    if (!saveProduct) return failed("failed_to_save_product", "Failed to save product");

    return success();
  }

  return {
    createProduct,
  };
}
