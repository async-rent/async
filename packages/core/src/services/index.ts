import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createCartService } from "./cart";
import { createCatalogService } from "./catalog";

export interface CreateAsyncOptions {
  db: DrizzleD1Database;
}

export function createAsync({ db }: CreateAsyncOptions) {
  const catalog = createCatalogService({ db });
  const cart = createCartService({ db });

  return {
    cart,
    catalog,
  };
}

export * from "./cart";
export * from "./catalog";
