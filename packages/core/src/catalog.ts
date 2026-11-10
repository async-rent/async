import { Database } from "@async-rent/db";
import type { Product, SetupPart } from "@async-rent/db";

/**
 * Determine whether a product is a Setup.
 * A product is a Setup when its type is 'setup'.
 */
export function isSetup(product: Product): boolean {
  return product.type === "setup";
}

/**
 * Get the parts (Includes spec) of a Setup product.
 * Returns the product entries that make up this Setup.
 */
export async function getSetupParts(db: Database, setupId: string): Promise<SetupPart[]> {
  return db.getSetupParts(setupId);
}

/**
 * Get the full part products for a Setup, enriched with product details.
 */
export async function getSetupPartProducts(db: Database, setupId: string): Promise<Product[]> {
  return db.getSetupPartProducts(setupId);
}

/**
 * Get the weekly price for a product in a given city.
 */
export async function priceForLocation(
  db: Database,
  productId: string,
  citySlug: string,
): Promise<number | null> {
  return db.getPrice(productId, citySlug);
}

/**
 * Get the deposit percentage for a product.
 */
export async function depositPercent(db: Database, productId: string): Promise<number> {
  return db.getDepositPercent(productId);
}

/**
 * Search products with optional query filter, scoped to a city.
 */
export async function searchProducts(
  db: Database,
  query: string,
  citySlug: string,
  limit = 10,
  page = 1,
): Promise<Product[]> {
  return db.searchProducts(query, citySlug, limit, page);
}

/**
 * Get a single product by ID.
 */
export async function getProduct(db: Database, id: string): Promise<Product | null> {
  return db.findProduct(id);
}

/**
 * List all setups by category, optionally scoped to a city for pricing.
 */
export async function listSetupsByCategory(
  db: Database,
  category: string,
  citySlug: string,
): Promise<Product[]> {
  return db.listSetupsByCategory(category, citySlug);
}
