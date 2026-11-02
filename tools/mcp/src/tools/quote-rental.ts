import type { Cart } from "@async-rent/core";
import {
  cartSchema,
  createRentalInputSchema,
  getCartByUserAndLocationInputSchema,
  isValidRentalPeriod,
  maxCartLineQuantity,
  maxCartLines,
  putItemInputSchema,
} from "@async-rent/core";
import { z } from "zod";
import type { CoreResult, Tool, ToolContext } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const { startDate, endDate } = createRentalInputSchema.shape;

const basketItemSchema = putItemInputSchema.pick({ productId: true }).extend({
  quantity: putItemInputSchema.shape.quantity
    .min(1)
    .describe(`Units of this product to rent (1 to ${maxCartLineQuantity}).`),
});

const hasUniqueProducts = (items: { productId: string }[]): boolean =>
  new Set(items.map((item) => item.productId)).size === items.length;

const inputSchema = getCartByUserAndLocationInputSchema
  .pick({ locationId: true })
  .extend({
    items: z
      .array(basketItemSchema)
      .min(1)
      .max(maxCartLines)
      .refine(hasUniqueProducts, { error: "List each productId once and set its quantity." })
      .describe(`The gear to rent and how many of each (at most ${maxCartLines} products).`),
    startDate,
    endDate,
  })
  .refine(isValidRentalPeriod, {
    error: "endDate cannot be before startDate",
    path: ["endDate"],
  });

type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  cart: cartSchema.describe(
    "The basket priced exactly as the website's cart shows it. create_rental places a rental from this cart.",
  ),
  startDate,
  endDate,
});

type Output = z.infer<typeof outputSchema>;

const toOutput =
  ({ startDate, endDate }: Input) =>
  (cart: Cart): Output => ({ cart, startDate, endDate });

// The quote is the user's cart for the city, so the rental placed from it
// freezes exactly these lines and totals, the same as a website checkout.
async function quoteBasket(
  { async, userId }: ToolContext,
  { locationId, items }: Input,
): Promise<CoreResult<Cart>> {
  const cart = await async.cart.getCartByUserAndLocation({ userId, locationId });
  if (!cart.success) return cart;

  const cartId = cart.data.id;
  const cleared = await async.cart.clearCart({ cartId });
  if (!cleared.success) return cleared;

  const puts = await Promise.all(items.map((item) => async.cart.putItem({ cartId, ...item })));
  const [failed] = puts.flatMap((put) => (put.success ? [] : [put]));
  if (failed) return failed;

  return async.cart.getCartById({ cartId });
}

export const quoteRental: Tool = (server, context) => {
  server.registerTool(
    "quote_rental",
    {
      title: "Quote rental",
      description:
        "Price a basket of gear in one location for a rental period, with the same totals the website shows. This replaces the user's cart in that location with exactly these items. totalDueToday is the first week plus deposit and delivery; weeklySubtotal is then billed every week until the rental is cancelled. Prices are integers in the location currency's minor unit, e.g. cents. Fails if a product is not rented there or not enough is in stock.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async (input) => toToolResult(await quoteBasket(context, input), toOutput(input)),
  );
};
