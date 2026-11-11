import type { Rental } from "@async-rent/core";
import { createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { getAsync, unwrap, type ErrorMessages } from "./async";

const notFoundMessage = "We couldn't find that order.";

/**
 * One of the visitor's own rentals by its number, or `null`. Someone else's
 * reads the same as a number that doesn't exist, so a guessed number reveals
 * nothing. Any other failure throws with `messages`.
 */
export const findOwnRental = createServerOnlyFn(
  async (userId: string, number: string, messages: ErrorMessages): Promise<Rental | null> => {
    const result = await getAsync().rental.getRentalByNumber({ number });
    if (!result.success && result.error.code === "rental_not_found") return null;

    const rental = unwrap(result, messages);
    return rental.userId === userId ? rental : null;
  },
);

/** One of the visitor's own rentals by its number; answers 404 for any other. */
export const loadOwnRental = createServerOnlyFn(
  async (userId: string, number: string, messages: ErrorMessages): Promise<Rental> => {
    const rental = await findOwnRental(userId, number, messages);
    if (rental) return rental;

    setResponseStatus(404);
    throw new Error(messages.rental_not_found ?? notFoundMessage);
  },
);
