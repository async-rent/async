import {
  cartItems,
  carts,
  locations,
  productImages,
  productPrices,
  products,
  rentalItems,
  rentals,
} from "@async-rent/db";
import type { NewRentalItemRow, RentalItemRow, RentalRow } from "@async-rent/db";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import type { Rental, RentalItem } from "../models";
import {
  addressSchema,
  cancellableRentalStatusValues,
  contactSchema,
  dateSchema,
  generateRentalNumber,
  isLocationActive,
  isRentalCancellable,
  priceLines,
  rentalSchema,
  rentalStatusSchema,
  timeWindowSchema,
} from "../models";
import { createResult, groupBy, paginationSchema } from "../utils";

export interface CreateRentalServiceOptions {
  db: DrizzleD1Database;
}

// A rental number clashing is rare, but the unique constraint is the arbiter:
// retry a few times before giving up rather than trusting randomness blindly.
const rentalNumberAttempts = 5;

/**
 * Whether a caught insert error is a clash on the unique rental `number`.
 *
 * SQLite reports it as `UNIQUE constraint failed: rentals.number`. Only this
 * one failure is worth retrying with a fresh number; any other error (a CHECK,
 * a foreign key, a transient fault) must surface with its cause intact rather
 * than be paid for five times behind a generic code.
 */
function isRentalNumberClash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return /unique constraint failed:\s*rentals\.number/i.test(message);
}

export const createRentalInputSchema = z
  .object({
    cartId: z.string().describe("Cart to turn into a rental; its available items are frozen."),
    contact: contactSchema.describe("Who to reach about the rental."),
    address: addressSchema.describe("Where to deliver the gear."),
    startDate: dateSchema.describe("First day of the rental period."),
    endDate: dateSchema
      .optional()
      .describe("Last day of the rental period; open-ended when omitted."),
    deliveryDate: dateSchema.optional().describe("Day the gear is dropped off."),
    deliveryWindow: timeWindowSchema.optional().describe("Local time window for the delivery."),
    termsAcceptedAt: z.iso
      .datetime({ offset: true })
      .optional()
      .describe("When the customer accepted the rental terms."),
    notes: z.string().optional().describe("Internal notes, not shown to the customer."),
  })
  // The cart carries no dates, so this input is the only gate on the period
  // before it reaches billing and delivery scheduling: a period must not end
  // before it starts, and the gear must not be dropped off after it starts.
  .refine((input) => !input.endDate || input.endDate >= input.startDate, {
    error: "endDate cannot be before startDate",
    path: ["endDate"],
  })
  .refine((input) => !input.deliveryDate || input.deliveryDate <= input.startDate, {
    error: "deliveryDate cannot be after startDate",
    path: ["deliveryDate"],
  });

export type CreateRentalInput = z.infer<typeof createRentalInputSchema>;

export const getRentalByIdInputSchema = z.object({
  rentalId: z.string().describe("Rental identifier."),
});

export type GetRentalByIdInput = z.infer<typeof getRentalByIdInputSchema>;

export const getRentalByNumberInputSchema = z.object({
  number: z.string().describe("Human-readable rental reference, e.g. AR-2026-7KQ4M2."),
});

export type GetRentalByNumberInput = z.infer<typeof getRentalByNumberInputSchema>;

export const listRentalsInputSchema = z.object({
  userId: z.string().optional().describe("Only return rentals placed by this user."),
  status: rentalStatusSchema.optional().describe("Only return rentals in this status."),
  page: z.number().int().positive().max(100).default(1).describe("1-based page number."),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("Number of rentals per page (max 50)."),
});

export type ListRentalsInput = z.infer<typeof listRentalsInputSchema>;

export const cancelRentalInputSchema = z.object({
  rentalId: z.string().describe("Rental to cancel."),
  reason: z.string().optional().describe("Internal note explaining the cancellation."),
});

export type CancelRentalInput = z.infer<typeof cancelRentalInputSchema>;

export const rentalPageSchema = paginationSchema(rentalSchema);
export type RentalPage = z.infer<typeof rentalPageSchema>;

const createRentalResult = createResult(
  rentalSchema,
  z.enum([
    "cart_not_found",
    "location_not_available",
    "cart_is_empty",
    "invalid_rental_period",
    "product_out_of_stock",
    "failed_to_load_cart",
    "failed_to_create_rental",
    "rental_data_invalid",
  ]),
);

export const createRentalResultSchema = createRentalResult.schema;
export type CreateRentalResult = z.infer<typeof createRentalResultSchema>;

const getRentalResult = createResult(
  rentalSchema,
  z.enum(["rental_not_found", "failed_to_load_rental", "rental_data_invalid"]),
);

export const getRentalResultSchema = getRentalResult.schema;
export type GetRentalResult = z.infer<typeof getRentalResultSchema>;

const listRentalsResult = createResult(rentalPageSchema, z.enum(["failed_to_list_rentals"]));

export const listRentalsResultSchema = listRentalsResult.schema;
export type ListRentalsResult = z.infer<typeof listRentalsResultSchema>;

const cancelRentalResult = createResult(
  rentalSchema,
  z.enum([
    "rental_not_found",
    "rental_not_cancellable",
    "failed_to_load_rental",
    "failed_to_save_rental",
    "rental_data_invalid",
  ]),
);

export const cancelRentalResultSchema = cancelRentalResult.schema;
export type CancelRentalResult = z.infer<typeof cancelRentalResultSchema>;

/** A cart line priced for the city, ready to freeze onto a rental. */
interface PricedLine {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imageAlt: string | null;
  quantity: number;
  weeklyPrice: number;
  deposit: number | null;
  /** Units the city has, or `null` when stock is not tracked for this line. */
  stock: number | null;
}

export function createRentalService({ db }: CreateRentalServiceOptions) {
  // Build a rental from its row and its frozen line items. The row already
  // carries the snapshot, so no catalog join is needed to read it back.
  function toRental(row: RentalRow, items: RentalItemRow[]): Rental {
    const lines: RentalItem[] = items.map((item) => ({
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      image: item.imageUrl ? { url: item.imageUrl, alt: item.imageAlt ?? undefined } : undefined,
      quantity: item.quantity,
      weeklyPrice: item.weeklyPrice,
      deposit: item.deposit ?? undefined,
    }));

    return {
      id: row.id,
      number: row.number,
      userId: row.userId ?? undefined,
      contact: {
        name: row.contactName,
        email: row.contactEmail,
        whatsapp: row.contactWhatsapp ?? undefined,
      },
      address: {
        line1: row.addressLine1,
        line2: row.addressLine2 ?? undefined,
        area: row.addressArea ?? undefined,
        city: row.addressCity,
        postcode: row.addressPostcode ?? undefined,
        countryCode: row.addressCountryCode,
        deliveryNotes: row.deliveryNotes ?? undefined,
      },
      locationId: row.locationId,
      currency: row.currency,
      items: lines,
      startDate: row.startDate,
      endDate: row.endDate ?? undefined,
      deliveryDate: row.deliveryDate ?? undefined,
      deliveryWindow:
        row.deliveryWindowStart && row.deliveryWindowEnd
          ? { start: row.deliveryWindowStart, end: row.deliveryWindowEnd }
          : undefined,
      status: row.status,
      fulfillmentStatus: row.fulfillmentStatus ?? undefined,
      summary: {
        currency: row.currency,
        weeklySubtotal: row.weeklySubtotal,
        deposit: row.deposit,
        deliveryFee: row.deliveryFee,
        discount: row.discount,
        totalDueToday: row.totalDueToday,
      },
      paymentStatusSnapshot: row.paymentStatusSnapshot ?? undefined,
      termsAcceptedAt: row.termsAcceptedAt?.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString(),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    };
  }

  const itemsOf = (rentalId: string) =>
    db
      .select()
      .from(rentalItems)
      .where(eq(rentalItems.rentalId, rentalId))
      .orderBy(asc(rentalItems.position));

  async function readRental(row: RentalRow): Promise<GetRentalResult> {
    const { success, failed } = getRentalResult;

    const items = await itemsOf(row.id).catch(() => null);
    if (!items) return failed("failed_to_load_rental", "Failed to load rental");

    const rental = toRental(row, items);
    if (!rentalSchema.safeParse(rental).success) {
      return failed("rental_data_invalid", `Rental ${row.id} has invalid data`);
    }

    return success(rental);
  }

  // The cart's available lines, priced for its city, in display order. Mirrors
  // the cart service's read: only active products the city still rents are
  // frozen onto the rental, so an unavailable line never becomes an order line.
  async function pricedLines(cartId: string): Promise<PricedLine[]> {
    const rows = await db
      .select({
        productId: cartItems.productId,
        name: products.name,
        slug: products.slug,
        quantity: cartItems.quantity,
        weeklyPrice: productPrices.weeklyPrice,
        deposit: productPrices.deposit,
        stock: productPrices.stock,
      })
      .from(cartItems)
      .innerJoin(carts, eq(carts.id, cartItems.cartId))
      .innerJoin(products, eq(products.id, cartItems.productId))
      .innerJoin(
        productPrices,
        and(
          eq(productPrices.productId, cartItems.productId),
          eq(productPrices.locationId, carts.locationId),
        ),
      )
      .where(and(eq(cartItems.cartId, cartId), eq(products.status, "active")))
      .orderBy(asc(products.name));

    const productIds = rows.map((row) => row.productId);
    const imageRows =
      productIds.length === 0
        ? []
        : await db
            .select()
            .from(productImages)
            .where(inArray(productImages.productId, productIds))
            .orderBy(asc(productImages.productId), asc(productImages.position));

    const coverOf = groupBy(imageRows, (row) => row.productId);

    return rows.map((row) => {
      const cover = coverOf.get(row.productId)?.[0];

      return {
        productId: row.productId,
        name: row.name,
        slug: row.slug,
        imageUrl: cover?.url ?? null,
        imageAlt: cover?.alt ?? null,
        quantity: row.quantity,
        weeklyPrice: row.weeklyPrice,
        deposit: row.deposit ?? null,
        stock: row.stock ?? null,
      };
    });
  }

  async function createRental(input: CreateRentalInput): Promise<CreateRentalResult> {
    const { success, failed } = createRentalResult;

    // Apps parse at the boundary, but the period rule is a hard invariant on
    // the stored row, so re-check it here and surface a typed failure rather
    // than trusting the caller or throwing a ZodError out of the service.
    const parsed = createRentalInputSchema.safeParse(input);
    if (!parsed.success) {
      return failed("invalid_rental_period", parsed.error.issues[0]?.message ?? "Invalid rental");
    }

    const loaded = await db
      .select({
        userId: carts.userId,
        locationId: carts.locationId,
        currency: locations.currency,
        deliveryFee: locations.deliveryFee,
        status: locations.status,
      })
      .from(carts)
      .innerJoin(locations, eq(locations.id, carts.locationId))
      .where(eq(carts.id, input.cartId))
      .limit(1)
      .catch(() => null);
    if (!loaded) return failed("failed_to_load_cart", "Failed to load cart");

    const [cart] = loaded;
    if (!cart) return failed("cart_not_found", `Cart ${input.cartId} not found`);
    if (!isLocationActive(cart)) {
      return failed("location_not_available", `Location ${cart.locationId} is not open yet`);
    }

    const lines = await pricedLines(input.cartId).catch(() => null);
    if (!lines) return failed("failed_to_load_cart", "Failed to load cart");
    if (lines.length === 0) {
      return failed("cart_is_empty", "A rental needs at least one available item");
    }

    // Re-check availability at the freeze, the same hard limit the cart service
    // enforces when a line is added: gear can sell out between "add to cart" and
    // "checkout", and a rental must never freeze more units than the city has.
    // Stock is held for this rental by decrementing it in the same batch below.
    const shortLine = lines.find((line) => line.stock != null && line.quantity > line.stock);
    if (shortLine) {
      return failed(
        "product_out_of_stock",
        `Only ${shortLine.stock} of ${shortLine.name} left in ${cart.locationId}`,
      );
    }

    const summary = priceLines({
      currency: cart.currency,
      deliveryFee: cart.deliveryFee,
      lines: lines.map((line) => ({
        weeklyPrice: line.weeklyPrice,
        deposit: line.deposit ?? undefined,
        quantity: line.quantity,
      })),
    });

    const rentalId = uuid();
    const now = new Date();
    const termsAcceptedAt = input.termsAcceptedAt ? new Date(input.termsAcceptedAt) : null;

    const itemRows: NewRentalItemRow[] = lines.map((line, position) => ({
      rentalId,
      position,
      productId: line.productId,
      name: line.name,
      slug: line.slug,
      imageUrl: line.imageUrl,
      imageAlt: line.imageAlt,
      quantity: line.quantity,
      weeklyPrice: line.weeklyPrice,
      deposit: line.deposit,
    }));

    // The lines that track stock; their units are held for this rental by
    // decrementing `product_prices.stock` in the same batch as the write.
    const stockedLines = lines.filter((line) => line.stock != null);

    // Insert the rental and its frozen lines, empty the cart, and reserve stock
    // as one transaction, retrying only the number — a clash on the unique
    // `number` is the one expected failure. Emptying the cart in the same batch
    // means a second submit finds an empty cart and is refused, so one cart can
    // never become two billable rentals.
    for (let attempt = 0; attempt < rentalNumberAttempts; attempt++) {
      const number = generateRentalNumber(now);

      const outcome = await db
        .batch([
          db.insert(rentals).values({
            id: rentalId,
            number,
            userId: cart.userId,
            cartId: input.cartId,
            contactName: input.contact.name,
            contactEmail: input.contact.email,
            contactWhatsapp: input.contact.whatsapp ?? null,
            addressLine1: input.address.line1,
            addressLine2: input.address.line2 ?? null,
            addressArea: input.address.area ?? null,
            addressCity: input.address.city,
            addressPostcode: input.address.postcode ?? null,
            addressCountryCode: input.address.countryCode,
            deliveryNotes: input.address.deliveryNotes ?? null,
            locationId: cart.locationId,
            currency: cart.currency,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            deliveryWindowStart: input.deliveryWindow?.start ?? null,
            deliveryWindowEnd: input.deliveryWindow?.end ?? null,
            status: "pending_payment",
            weeklySubtotal: summary.weeklySubtotal,
            deposit: summary.deposit,
            deliveryFee: summary.deliveryFee,
            discount: summary.discount,
            totalDueToday: summary.totalDueToday,
            termsAcceptedAt,
            notes: input.notes ?? null,
          }),
          db.insert(rentalItems).values(itemRows),
          db.delete(cartItems).where(eq(cartItems.cartId, input.cartId)),
          ...stockedLines.map((line) =>
            db
              .update(productPrices)
              .set({ stock: sql`${productPrices.stock} - ${line.quantity}` })
              .where(
                and(
                  eq(productPrices.productId, line.productId),
                  eq(productPrices.locationId, cart.locationId),
                ),
              ),
          ),
        ])
        .then(() => ({ ok: true as const }))
        .catch((error: unknown) => ({ ok: false as const, error }));

      if (!outcome.ok) {
        // Only a clash on the number is retried; any other failure is surfaced.
        if (isRentalNumberClash(outcome.error)) continue;

        return failed("failed_to_create_rental", "Failed to create rental");
      }

      const read = await db
        .batch([
          db.select().from(rentals).where(eq(rentals.id, rentalId)).limit(1),
          itemsOf(rentalId),
        ])
        .catch(() => null);

      const created = read?.[0]?.[0];
      const savedItems = read?.[1];
      if (!created || !savedItems) {
        return failed("failed_to_create_rental", "Failed to create rental");
      }

      const rental = toRental(created, savedItems);
      if (!rentalSchema.safeParse(rental).success) {
        return failed("rental_data_invalid", `Rental ${created.id} has invalid data`);
      }

      return success(rental);
    }

    return failed("failed_to_create_rental", "Failed to create rental");
  }

  async function getRentalById(input: GetRentalByIdInput): Promise<GetRentalResult> {
    const { failed } = getRentalResult;

    const rows = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, input.rentalId))
      .limit(1)
      .catch(() => null);
    if (!rows) return failed("failed_to_load_rental", "Failed to load rental");

    const [row] = rows;
    if (!row) return failed("rental_not_found", `Rental ${input.rentalId} not found`);

    return readRental(row);
  }

  async function getRentalByNumber(input: GetRentalByNumberInput): Promise<GetRentalResult> {
    const { failed } = getRentalResult;

    const rows = await db
      .select()
      .from(rentals)
      .where(eq(rentals.number, input.number))
      .limit(1)
      .catch(() => null);
    if (!rows) return failed("failed_to_load_rental", "Failed to load rental");

    const [row] = rows;
    if (!row) return failed("rental_not_found", `Rental ${input.number} not found`);

    return readRental(row);
  }

  async function listRentals(input: ListRentalsInput): Promise<ListRentalsResult> {
    const { success, failed } = listRentalsResult;
    const { userId, status, page, pageSize } = input;

    const where = and(
      userId ? eq(rentals.userId, userId) : undefined,
      status ? eq(rentals.status, status) : undefined,
    );

    const batch = await db
      .batch([
        db.select({ total: count() }).from(rentals).where(where),
        db
          .select()
          .from(rentals)
          .where(where)
          .orderBy(desc(rentals.createdAt), asc(rentals.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
      ])
      .catch(() => null);
    if (!batch) return failed("failed_to_list_rentals", "Failed to list rentals");

    const [[counted], rows] = batch;
    const total = counted?.total ?? 0;

    if (rows.length === 0) {
      return success({ items: [], total, hasMore: false });
    }

    const rentalIds = rows.map((row) => row.id);
    const itemRows = await db
      .select()
      .from(rentalItems)
      .where(inArray(rentalItems.rentalId, rentalIds))
      .orderBy(asc(rentalItems.rentalId), asc(rentalItems.position))
      .catch(() => null);
    if (!itemRows) return failed("failed_to_list_rentals", "Failed to list rentals");

    const itemsByRental = groupBy(itemRows, (row) => row.rentalId);

    // A rental that no longer fits the schema is left out rather than failing
    // the whole page, matching the catalog service's read.
    const items = rows.flatMap((row) => {
      const rental = toRental(row, itemsByRental.get(row.id) ?? []);

      return rentalSchema.safeParse(rental).success ? [rental] : [];
    });

    return success({ items, total, hasMore: page * pageSize < total });
  }

  async function cancelRental(input: CancelRentalInput): Promise<CancelRentalResult> {
    const { success, failed } = cancelRentalResult;

    const rows = await db
      .select()
      .from(rentals)
      .where(eq(rentals.id, input.rentalId))
      .limit(1)
      .catch(() => null);
    if (!rows) return failed("failed_to_load_rental", "Failed to load rental");

    const [row] = rows;
    if (!row) return failed("rental_not_found", `Rental ${input.rentalId} not found`);
    if (!isRentalCancellable(row.status)) {
      return failed(
        "rental_not_cancellable",
        `Rental ${row.number} is ${row.status} and cannot be cancelled`,
      );
    }

    const notes =
      input.reason && row.notes
        ? `${row.notes}\n${input.reason}`
        : (input.reason ?? row.notes ?? null);

    const updated = await db
      .update(rentals)
      .set({ status: "cancelled", cancelledAt: new Date(), notes })
      .where(
        and(
          eq(rentals.id, input.rentalId),
          inArray(rentals.status, [...cancellableRentalStatusValues]),
        ),
      )
      .returning()
      .catch(() => null);
    if (!updated) return failed("failed_to_save_rental", "Failed to save rental");

    const cancelled = updated[0];
    // The row moved out of a cancellable status between the read and the write.
    if (!cancelled) {
      return failed(
        "rental_not_cancellable",
        `Rental ${row.number} is ${row.status} and cannot be cancelled`,
      );
    }

    const items = await itemsOf(cancelled.id).catch(() => null);
    if (!items) return failed("failed_to_load_rental", "Failed to load rental");

    const rental = toRental(cancelled, items);
    if (!rentalSchema.safeParse(rental).success) {
      return failed("rental_data_invalid", `Rental ${cancelled.id} has invalid data`);
    }

    return success(rental);
  }

  return {
    createRental,
    getRentalById,
    getRentalByNumber,
    listRentals,
    cancelRental,
  };
}
