import type { Product } from "@async-rent/core";
import {
  getProductByIdInputSchema,
  priceForLocation,
  productPriceSchema,
  productSchema,
} from "@async-rent/core";
import { z } from "zod";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const inputSchema = getProductByIdInputSchema.extend({
  locationId: z.string().optional().describe("Location to quote the weekly price in."),
});

const outputSchema = z.object({
  product: productSchema,
  price: productPriceSchema
    .optional()
    .describe(
      "Weekly price, deposit and stock in the requested location; absent when no location is given or the product is not rented there.",
    ),
});

type Output = z.infer<typeof outputSchema>;

const toOutput =
  (locationId: string | undefined) =>
  (product: Product): Output => {
    if (!locationId) return { product };

    return { product, price: priceForLocation(product, locationId) };
  };

export const getProduct: Tool = (server, { async }) => {
  server.registerTool(
    "get_product",
    {
      title: "Get product",
      description:
        "Get one product's full details: description, images, highlights, specs and its weekly price in every location. Pass locationId to also get the weekly price, deposit and stock in that city. Prices are integers in the location currency's minor unit, e.g. cents.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      toToolResult(await async.catalog.getProductById(input), toOutput(input.locationId)),
  );
};
