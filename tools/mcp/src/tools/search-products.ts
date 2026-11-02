import type { Product, ProductPage, ProductPrice } from "@async-rent/core";
import {
  paginationSchema,
  priceForLocation,
  productPriceSchema,
  productSchema,
  searchProductsInputSchema,
} from "@async-rent/core";
import { z } from "zod";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = searchProductsInputSchema;

// Card-sized results keep a page small enough to reason over; get_product has the rest.
const productSummarySchema = productSchema
  .pick({ id: true, slug: true, name: true, tagline: true, categoryId: true, badge: true })
  .extend({
    prices: z
      .array(productPriceSchema)
      .min(1)
      .describe(
        "Weekly price per location; only the searched location's when locationId is given.",
      ),
  });

const outputSchema = paginationSchema(productSummarySchema);

type Output = z.infer<typeof outputSchema>;

// Search only returns products rented in the given location, so a price is always found there.
function pricesIn(product: Product, locationId: string | undefined): ProductPrice[] {
  if (!locationId) return product.prices;

  const price = priceForLocation(product, locationId);
  if (!price) return product.prices;

  return [price];
}

const toOutput =
  (locationId: string | undefined) =>
  (page: ProductPage): Output => ({
    ...page,
    items: page.items.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      categoryId: product.categoryId,
      badge: product.badge,
      prices: pricesIn(product, locationId),
    })),
  });

export const searchProducts: Tool = (server, { async }) => {
  server.registerTool(
    "search_products",
    {
      title: "Search products",
      description:
        "Search the workspace equipment Async rents, filtered by search words, category, location and a weekly price ceiling, then sorted and paged. Prices are integers in the location currency's minor unit, e.g. cents. Returns compact cards; call get_product for a product's full details.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      toToolResult(await async.catalog.searchProducts(input), toOutput(input.locationId)),
  );
};
