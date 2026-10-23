import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateRangeSchema } from "../utils/date-range";
import { dateTimeSchema } from "../utils/date-time";
import { moneySchema } from "../utils/money";

/**
 * Physical inventory and date-based reservations.
 *
 * `Product.availability` is a marketing snapshot. For rentals, the real
 * question is "which physical unit is free between these dates at this
 * location?" — that is answered by inventory units and reservations.
 */

/** Lifecycle state of a physical unit. */
export const inventoryUnitStatusSchema = z
  .enum(["available", "reserved", "rented", "maintenance", "retired", "lost"])
  .describe("Current state of the physical unit.");

/** Condition grade used by operations. */
export const inventoryConditionSchema = z
  .enum(["new", "excellent", "good", "fair", "damaged"])
  .describe("Physical condition of the unit.");

/** Lifecycle state of a reservation. */
export const reservationStatusSchema = z
  .enum(["held", "confirmed", "active", "released", "expired", "converted"])
  .describe("Current state of the date-range hold.");

/** State of a maintenance record. */
export const maintenanceStatusSchema = z
  .enum(["scheduled", "in_progress", "completed", "cancelled"])
  .describe("Current state of the maintenance work.");

/** Reason a unit is taken out of circulation. */
export const maintenanceReasonSchema = z
  .enum(["routine", "repair", "cleaning", "inspection", "damage"])
  .describe("Why maintenance is needed.");

/**
 * A serialised physical asset.
 *
 * One row per desk, chair, monitor, etc. This is what lets Async know that a
 * specific chair is rented to a specific rental until a specific date.
 */
export const inventoryUnitSchema = z
  .object({
    id: z.string().describe("Stable inventory-unit identifier."),
    serialNumber: z.string().optional().describe("Manufacturer serial number, when available."),
    assetTag: z.string().optional().describe("Internal asset tag printed on the unit."),
    productId: z.string().describe("Product this unit fulfils."),
    locationId: z.string().describe("Location where the unit is stored."),
    status: inventoryUnitStatusSchema,
    condition: inventoryConditionSchema,
    purchasePrice: moneySchema.optional().describe("What Async paid for the unit, when tracked."),
    currentRentalId: z.string().optional().describe("Rental currently holding the unit."),
    currentRentalItemId: z.string().optional().describe("Rental line currently holding the unit."),
    acquiredAt: dateTimeSchema.optional().describe("When the unit entered the fleet."),
    retiredAt: dateTimeSchema.optional().describe("When the unit left the rentable fleet."),
    notes: z.string().optional().describe("Operational notes about the unit."),
  })
  .extend(auditFieldsSchema.shape);

export type InventoryUnit = z.infer<typeof inventoryUnitSchema>;

/**
 * A date-range hold on inventory.
 *
 * For serialised fleets, `inventoryUnitId` is set. For pooled products, the
 * reservation can instead reference a `productId` and `quantity`. The outer
 * layer must prevent overlapping confirmed reservations.
 */
export const reservationSchema = z
  .object({
    id: z.string().describe("Stable reservation identifier."),
    inventoryUnitId: z
      .string()
      .optional()
      .describe("Specific unit being reserved, when the fleet is serialised."),
    productId: z.string().describe("Product being reserved."),
    productOfferingId: z
      .string()
      .optional()
      .describe("Location offering the reservation belongs to."),
    locationId: z.string().describe("Location holding the inventory."),
    rentalId: z.string().optional().describe("Rental that owns the reservation."),
    rentalItemId: z.string().optional().describe("Rental line that owns the reservation."),
    quantity: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Units held when reserving pooled inventory; defaults to 1."),
    period: dateRangeSchema.describe("Dates the inventory is held for."),
    status: reservationStatusSchema,
    expiresAt: dateTimeSchema
      .optional()
      .describe("When a temporary hold expires if not confirmed."),
  })
  .extend(auditFieldsSchema.shape);

export type Reservation = z.infer<typeof reservationSchema>;

/** Work that takes a unit out of the rentable fleet. */
export const maintenanceRecordSchema = z
  .object({
    id: z.string().describe("Stable maintenance-record identifier."),
    inventoryUnitId: z.string().describe("Unit being maintained."),
    reason: maintenanceReasonSchema,
    status: maintenanceStatusSchema,
    scheduledFor: dateTimeSchema.optional().describe("When the work is scheduled."),
    startedAt: dateTimeSchema.optional().describe("When work started."),
    completedAt: dateTimeSchema.optional().describe("When work completed."),
    cost: moneySchema.optional().describe("Cost of parts and labour."),
    notes: z.string().optional().describe("What was done or found."),
  })
  .extend(auditFieldsSchema.shape);

export type MaintenanceRecord = z.infer<typeof maintenanceRecordSchema>;

/**
 * Read-model answer to "how many units are free?".
 *
 * Computed from inventory units, reservations and maintenance records for a
 * product, location and date range.
 */
export const inventoryAvailabilitySchema = z.object({
  productId: z.string().describe("Product being checked."),
  locationId: z.string().describe("Location being checked."),
  period: dateRangeSchema.describe("Dates the availability applies to."),
  totalUnits: z.number().int().nonnegative().describe("Units that exist in the fleet."),
  availableUnits: z.number().int().nonnegative().describe("Units free for the entire period."),
  reservedUnits: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Units held by active reservations."),
  maintenanceUnits: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Units unavailable because of maintenance."),
  updatedAt: dateTimeSchema.optional().describe("When the availability projection was computed."),
});

export type InventoryAvailability = z.infer<typeof inventoryAvailabilitySchema>;
