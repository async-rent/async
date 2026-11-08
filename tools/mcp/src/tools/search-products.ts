import type { Category, Product, ProductPage, ProductPrice } from "@async-rent/core";
import {
  isSetup,
  paginationSchema,
  priceForLocation,
  productPriceSchema,
  productSchema,
  searchProductsInputSchema,
  setupParts,
} from "@async-rent/core";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import setupPickerHtml from "../../dist/widgets/setup-picker/index.html?raw";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";
import { registerWidget } from "../shared/widgets";

const setupPickerUri = "ui://async/setup-picker.html";

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
    image: z
      .object({
        url: z.url().describe("Absolute URL of the photo."),
        alt: z.string().describe("Alternative text describing the photo."),
      })
      .optional()
      .describe("The product's cover photo."),
    parts: z
      .array(z.string())
      .optional()
      .describe("Set only for a Setup: the product names of the gear it includes."),
  });

const outputSchema = paginationSchema(productSummarySchema);

/** The structured content search_products returns, which the Setup picker widget renders. */
export type SearchProductsOutput = z.infer<typeof outputSchema>;
export type ProductSummary = SearchProductsOutput["items"][number];

interface ProductSummaryContext {
  locationId: string | undefined;
  /** Every category, so a card can tell whether its product is a Setup. */
  categories: Category[];
  storefrontUrl: string;
}

// Search only returns products rented in the given location, so a price is always found there.
function pricesIn(product: Product, locationId: string | undefined): ProductPrice[] {
  if (!locationId) return product.prices;

  const price = priceForLocation(product, locationId);
  if (!price) return product.prices;

  return [price];
}

// Image paths are relative to the storefront that serves them; absolute URLs pass through.
function coverImage(product: Product, storefrontUrl: string): ProductSummary["image"] {
  const [cover] = product.images;
  if (!cover) return undefined;

  return { url: new URL(cover.url, storefrontUrl).href, alt: cover.alt ?? product.name };
}

const toOutput =
  ({ locationId, categories, storefrontUrl }: ProductSummaryContext) =>
  (page: ProductPage): SearchProductsOutput => ({
    ...page,
    items: page.items.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      categoryId: product.categoryId,
      badge: product.badge,
      prices: pricesIn(product, locationId),
      image: coverImage(product, storefrontUrl),
      parts: isSetup(product, categories) ? setupParts(product) : undefined,
    })),
  });

export const searchProducts: Tool = (server, { async, storefrontUrl }) => {
  registerWidget(server, {
    name: "Setup picker",
    uri: setupPickerUri,
    html: setupPickerHtml,
    // Card photos are served by the storefront.
    resourceDomains: [new URL(storefrontUrl).origin],
  });

  registerAppTool(
    server,
    "search_products",
    {
      title: "Search products",
      description:
        "Search the workspace equipment Async rents, filtered by search words, category, location and a weekly price ceiling, then sorted and paged. Prices are integers in the location currency's minor unit, e.g. cents. Returns compact cards; call get_product for a product's full details. In hosts that support MCP Apps, the results also open an interactive picker where the customer selects one or more cards and presses Rent these, which sends you a message naming each pick and its id; then ask for the rental dates and quote as usual. The picker shows only this page of results, so search again when the customer asks for more or different gear.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: setupPickerUri } },
    },
    async (input) => {
      const [found, listed] = await Promise.all([
        async.catalog.searchProducts(input),
        async.catalog.listCategories(),
      ]);

      // Parts only enrich the cards, so a failed category read leaves them out
      // instead of failing the search.
      if (!listed.success) console.error(listed.error);
      const categories = listed.success ? listed.data : [];

      return toToolResult(
        found,
        toOutput({ locationId: input.locationId, categories, storefrontUrl }),
      );
    },
  );
};
