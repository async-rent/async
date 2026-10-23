import { fromAny } from "@total-typescript/shoehorn";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { describe, expect, it, vi } from "vite-plus/test";
import { makeProduct } from "../../tests/factories";
import { createCatalogService } from "./catalog";

interface DbMockOptions {
  /** Rows returned by the existence lookup. Defaults to none. */
  existing?: unknown[];
  /** When set, the existence lookup rejects instead of resolving. */
  selectError?: Error;
  /** When set, the insert rejects instead of resolving. */
  insertError?: Error;
}

function createDbMock(options: DbMockOptions = {}) {
  const select = vi.fn(() => ({
    from: () =>
      options.selectError
        ? Promise.reject(options.selectError)
        : Promise.resolve(options.existing ?? []),
  }));

  const insert = vi.fn(() => ({
    values: () => ({
      returning: () =>
        options.insertError ? Promise.reject(options.insertError) : Promise.resolve([{}]),
    }),
  }));

  const db: DrizzleD1Database = fromAny({ select, insert });

  return { db, select, insert };
}

describe("createCatalogService", () => {
  it("creates a product when none exists", async () => {
    const { db, select, insert } = createDbMock({ existing: [] });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({ success: true });

    expect(select).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("fails when a product with the same id already exists", async () => {
    const product = makeProduct();
    const { db, insert } = createDbMock({ existing: [product] });
    const service = createCatalogService({ db });

    const result = await service.createProduct(product);

    expect(result).toEqual({
      success: false,
      error: {
        code: "product_already_exists",
        message: `Product with id ${product.id} already exists`,
      },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails when the existence lookup throws", async () => {
    const { db } = createDbMock({ selectError: new Error("d1 unavailable") });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_fetch_product", message: "Failed to fetch product" },
    });
  });

  it("fails when the insert throws", async () => {
    const { db } = createDbMock({ insertError: new Error("d1 unavailable") });
    const service = createCatalogService({ db });

    await expect(service.createProduct(makeProduct())).resolves.toEqual({
      success: false,
      error: { code: "failed_to_save_product", message: "Failed to save product" },
    });
  });
});
