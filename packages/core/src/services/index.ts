import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createCatalogService } from "./catalog";

export interface CreateAsyncOptions {
  db: DrizzleD1Database;
}

export function createAsync({ db }: CreateAsyncOptions) {
  const catalog = createCatalogService({ db });

  return {
    catalog,
  };
}

export * from "./catalog";
