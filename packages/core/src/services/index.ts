import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createCartService } from "./cart";
import { createCatalogService } from "./catalog";
import { createRentalService } from "./rental";

export interface CreateAsyncOptions {
  db: DrizzleD1Database;
}

export function createAsync({ db }: CreateAsyncOptions) {
  const catalog = createCatalogService({ db });
  const cart = createCartService({ db });
  const rental = createRentalService({ db });

  return {
    cart,
    catalog,
    rental,
  };
}

export * from "./cart";
export * from "./catalog";
export * from "./rental";
