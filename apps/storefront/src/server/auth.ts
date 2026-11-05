import { auth } from "@clerk/tanstack-react-start/server";
import { createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

/**
 * The signed-in visitor's id; answers 401 otherwise. Carts and rentals are
 * keyed by user, so every write needs one.
 */
export const requireUserId = createServerOnlyFn(async (): Promise<string> => {
  const { userId } = await auth();
  if (userId) return userId;

  setResponseStatus(401);
  throw new Error("Sign in to rent gear");
});
