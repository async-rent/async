import type { GetRentalResult, Rental } from "@async-rent/core";
import { rentalSchema } from "@async-rent/core";
import type { z } from "zod";
import type { ToolContext } from "./tools";

/** A rental as its customer sees it: internal notes stay with Async's staff. */
export const customerRentalSchema = rentalSchema.omit({ notes: true });

export type CustomerRental = z.infer<typeof customerRentalSchema>;

export const toCustomerRental = ({ notes: _notes, ...rental }: Rental): CustomerRental => rental;

/**
 * The signed-in user's rental by its number. Someone else's rental reads as not
 * found, so a guessed number never confirms that a rental exists.
 */
export async function getOwnRental(
  { async, userId }: ToolContext,
  number: string,
): Promise<GetRentalResult> {
  const rental = await async.rental.getRentalByNumber({ number });
  if (!rental.success) return rental;
  if (rental.data.userId === userId) return rental;

  return {
    success: false,
    error: { code: "rental_not_found", message: `Rental ${number} not found` },
  };
}
