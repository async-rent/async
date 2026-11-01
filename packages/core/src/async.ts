import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createCartService } from "./services/cart";
import { createCatalogService } from "./services/catalog";
import { createPricingService } from "./services/pricing";
import { createRentalService } from "./services/rental";

export interface CreateAsyncOptions {
  /** The D1 database the services read and write through. */
  db: DrizzleD1Database;
}

/**
 * The composition root for all business logic. One factory builds every
 * service and injects the dependencies between them, returning them grouped by
 * area:
 *
 * ```ts
 * const async = createAsync({ db });
 * const products = await async.catalog.searchProducts({ sort: "featured", page: 1, pageSize: 12 });
 * const rentable = async.catalog.isProductRentable({ product });
 * const total = async.pricing.priceLines({ currency: "USD", deliveryFee: 0, lines: [] });
 * ```
 *
 * Pricing is a pure service with no database, so it is built first and injected
 * into the cart and rental services that total their lines through it — the
 * dependency is explicit in each factory's options rather than hidden behind an
 * import. Each service holds no state of its own beyond what it is given, so one
 * `async` instance can serve a whole request. Validation stays at the consumer:
 * core exports the schemas, and the consumer parses input before it calls in.
 */
export function createAsync({ db }: CreateAsyncOptions) {
  const pricing = createPricingService();

  return {
    catalog: createCatalogService({ db }),
    cart: createCartService({ db, pricing }),
    rental: createRentalService({ db, pricing }),
    pricing,
  };
}

export type Async = ReturnType<typeof createAsync>;
