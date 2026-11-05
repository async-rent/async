import { toast } from "@async-rent/ui/components/toast";
import { useAuth, useClerk } from "@clerk/tanstack-react-start";
import type { Cart } from "@async-rent/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useCartDrawer } from "../components/cart/cart-drawer-context";
import { addCartItem, getCart, setCartItemQuantity } from "../server/cart";
import { useRentalPlan } from "./use-rental-plan";

// One cart per signed-in user and city, mirroring how core keys carts.
function cartQueryKey(userId: string | null | undefined, locationId: string) {
  return ["cart", userId ?? null, locationId] as const;
}

/** Units across every line, the count the header badge and drawer title show. */
export function cartUnitCount(cart: Cart | null): number {
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}

/** The visitor's cart in their current city. Signed-out visitors have none. */
export function useCart() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { plan } = useRentalPlan();

  const query = useQuery({
    queryKey: cartQueryKey(userId, plan.locationId),
    queryFn: () => getCart({ data: { locationId: plan.locationId } }),
    enabled: isLoaded && isSignedIn === true,
  });

  return {
    cart: query.data ?? null,
    isSignedIn: isLoaded && isSignedIn === true,
    isLoading: !isLoaded || query.isPending,
  };
}

function showCartError(error: Error) {
  toast.add({ title: "Your cart wasn't updated", description: error.message, type: "error" });
}

/**
 * Cart writes. Every Add button goes through `addToCart`: it asks a
 * signed-out visitor to sign in first, and opens the drawer once the item is in.
 */
export function useCartActions() {
  const queryClient = useQueryClient();
  const clerk = useClerk();
  const { isSignedIn, userId } = useAuth();
  const { plan } = useRentalPlan();
  const { setOpen } = useCartDrawer();
  const add = useServerFn(addCartItem);
  const setQuantity = useServerFn(setCartItemQuantity);

  const key = cartQueryKey(userId, plan.locationId);

  const adding = useMutation({
    mutationFn: (productId: string) => add({ data: { locationId: plan.locationId, productId } }),
    onSuccess: (cart) => {
      queryClient.setQueryData(key, cart);
      setOpen(true);
    },
    onError: showCartError,
  });

  const updating = useMutation({
    mutationFn: (line: { productId: string; quantity: number }) =>
      setQuantity({ data: { locationId: plan.locationId, ...line } }),
    onSuccess: (cart) => queryClient.setQueryData(key, cart),
    onError: showCartError,
  });

  function addToCart(productId: string) {
    if (!isSignedIn) {
      clerk.openSignIn();
      return;
    }

    adding.mutate(productId);
  }

  return {
    addToCart,
    setQuantity: updating.mutate,
    /** The product being added right now, if any. */
    addingProductId: adding.isPending ? adding.variables : undefined,
    /** The cart line being changed right now, if any. */
    updatingProductId: updating.isPending ? updating.variables.productId : undefined,
  };
}
