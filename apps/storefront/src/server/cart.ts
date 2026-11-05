import { cartLineQuantitySchema, maxCartLines } from "@async-rent/core";
import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import { assertOk, getAsync, unwrap } from "./async";

const cartInput = z.object({ locationId: z.string() });

const addCartItemInput = cartInput.extend({ productId: z.string() });

const setCartItemQuantityInput = addCartItemInput.extend({ quantity: cartLineQuantitySchema });

// Core's messages for these name product and location ids.
const putItemMessages = {
  product_out_of_stock: "That's every unit we have in this city right now.",
  cart_is_full: `Your cart holds up to ${maxCartLines} different items.`,
  product_not_available: "This item isn't rented in this city.",
  location_not_available: "This city isn't open for rentals yet.",
};

// Only a signed-in visitor has a cart: core keys carts by user and city.
async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (userId) return userId;

  setResponseStatus(401);
  throw new Error("Sign in to rent gear");
}

/** The visitor's cart in a city, or `null` while they are signed out. */
export const getCart = createServerFn({ method: "GET" })
  .validator(cartInput)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) return null;

    return unwrap(
      await getAsync().cart.getCartByUserAndLocation({ userId, locationId: data.locationId }),
    );
  });

/** Adds one unit of a product to the visitor's cart and returns the updated cart. */
export const addCartItem = createServerFn({ method: "POST" })
  .validator(addCartItemInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const async = getAsync();

    const cart = unwrap(
      await async.cart.getCartByUserAndLocation({ userId, locationId: data.locationId }),
    );
    const held = cart.items.find((item) => item.productId === data.productId)?.quantity ?? 0;

    assertOk(
      await async.cart.putItem({
        cartId: cart.id,
        productId: data.productId,
        quantity: held + 1,
      }),
      putItemMessages,
    );

    return unwrap(await async.cart.getCartById({ cartId: cart.id }));
  });

/** Sets how many units of a product the cart holds; zero removes the line. */
export const setCartItemQuantity = createServerFn({ method: "POST" })
  .validator(setCartItemQuantityInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const async = getAsync();

    const cart = unwrap(
      await async.cart.getCartByUserAndLocation({ userId, locationId: data.locationId }),
    );

    assertOk(
      await async.cart.putItem({
        cartId: cart.id,
        productId: data.productId,
        quantity: data.quantity,
      }),
      putItemMessages,
    );

    return unwrap(await async.cart.getCartById({ cartId: cart.id }));
  });
