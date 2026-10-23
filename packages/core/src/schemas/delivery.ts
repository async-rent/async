import { z } from "zod";
import { addressSnapshotSchema } from "./address";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateSchema } from "../utils/date";
import { dateTimeSchema } from "../utils/date-time";
import { timeWindowSchema } from "../utils/time-window";
import { contactSchema } from "./customer";
import { imageSchema } from "./media";

/**
 * Delivery, pickup, swap and repair jobs.
 *
 * The storefront promises free delivery and setup within 24 hours and says
 * "We'll WhatsApp before arrival". Those promises are fulfilled by jobs
 * scheduled into a location's delivery slots.
 */

/** Kind of physical visit. */
export const deliveryTypeSchema = z
  .enum(["delivery", "pickup", "swap", "repair"])
  .describe("What the operations team needs to do on site.");

/** Lifecycle state of a delivery job. */
export const deliveryStatusSchema = z
  .enum([
    "scheduled",
    "dispatched",
    "en_route",
    "arrived",
    "completed",
    "failed",
    "cancelled",
    "rescheduled",
  ])
  .describe("Current stage of the physical job.");

/** Availability of a delivery slot. */
export const deliverySlotStatusSchema = z
  .enum(["open", "full", "closed"])
  .describe("Whether customers can still book the slot.");

/**
 * A bookable delivery window at a location.
 *
 * The checkout currently offers specific dates (skipping Sundays), which map
 * to these slots. Capacity is enforced by the outer layer.
 */
export const deliverySlotSchema = z
  .object({
    id: z.string().describe("Stable delivery-slot identifier."),
    locationId: z.string().describe("Location the slot belongs to."),
    date: dateSchema.describe("Date of the slot."),
    window: timeWindowSchema.describe("Local start and end time of the slot."),
    capacity: z
      .number()
      .int()
      .positive()
      .describe("Maximum number of jobs that can be booked in this slot."),
    bookedCount: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Jobs already booked into the slot."),
    cutoffAt: dateTimeSchema.optional().describe("Last moment the slot can be booked."),
    status: deliverySlotStatusSchema,
  })
  .extend(auditFieldsSchema.shape);

export type DeliverySlot = z.infer<typeof deliverySlotSchema>;

/** Person or crew assigned to a delivery job. */
export const deliveryAssigneeSchema = z.object({
  id: z.string().optional().describe("Internal staff or crew identifier."),
  name: z.string().optional().describe("Display name."),
  phone: z.string().optional().describe("Contact number for the customer."),
});

export type DeliveryAssignee = z.infer<typeof deliveryAssigneeSchema>;

/**
 * A scheduled or completed physical job.
 *
 * The address is a snapshot for the same reason as on a rental: editing a
 * saved address must not rewrite where a past delivery happened.
 */
export const deliverySchema = z
  .object({
    id: z.string().describe("Stable delivery-job identifier."),
    rentalId: z.string().describe("Rental the job belongs to."),
    type: deliveryTypeSchema,
    status: deliveryStatusSchema,
    slotId: z.string().optional().describe("Booked delivery slot."),
    scheduledDate: dateSchema.optional().describe("Scheduled date of the visit."),
    window: timeWindowSchema.optional().describe("Scheduled arrival window."),
    address: addressSnapshotSchema.describe("Address snapshot the crew should visit."),
    contact: contactSchema
      .optional()
      .describe("Contact snapshot for WhatsApp updates and arrival calls."),
    assignee: deliveryAssigneeSchema.optional().describe("Crew assigned to the job."),
    notes: z.string().optional().describe("Operational notes for the crew."),
    proofImages: z
      .array(imageSchema)
      .optional()
      .describe("Photos proving delivery, setup or pickup."),
    completedAt: dateTimeSchema.optional().describe("When the job completed."),
    failureReason: z.string().optional().describe("Why the visit could not be completed."),
  })
  .extend(auditFieldsSchema.shape);

export type Delivery = z.infer<typeof deliverySchema>;
