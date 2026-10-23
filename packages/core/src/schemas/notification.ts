import { z } from "zod";
import { auditFieldsSchema } from "../utils/audit-fields";
import { dateTimeSchema } from "../utils/date-time";
import { metadataSchema } from "../utils/metadata";

/**
 * Outbound customer notifications.
 *
 * Checkout says delivery updates happen by email and WhatsApp, and the crew
 * messages before arrival. This model records what was sent, when and through
 * which channel.
 */

/** Delivery channel for a notification. */
export const notificationChannelSchema = z
  .enum(["email", "whatsapp", "sms", "push"])
  .describe("Channel used to deliver the message.");

/** Delivery state of a notification. */
export const notificationStatusSchema = z
  .enum(["queued", "sent", "delivered", "failed", "cancelled"])
  .describe("Current state of the notification.");

export const notificationSchema = z
  .object({
    id: z.string().describe("Stable notification identifier."),
    customerId: z.string().optional().describe("Customer receiving the message."),
    rentalId: z.string().optional().describe("Rental the message relates to."),
    deliveryId: z.string().optional().describe("Delivery job the message relates to."),
    channel: notificationChannelSchema,
    template: z.string().describe('Template key, e.g. "delivery_scheduled" or "arriving_soon".'),
    recipient: z.string().describe("Email address or phone number the message was sent to."),
    payload: metadataSchema.optional().describe("Template variables and provider response data."),
    status: notificationStatusSchema,
    scheduledAt: dateTimeSchema.optional().describe("When the message should be sent."),
    sentAt: dateTimeSchema.optional().describe("When the provider accepted the message."),
    failureReason: z.string().optional().describe("Why the message could not be delivered."),
  })
  .extend(auditFieldsSchema.shape);

export type Notification = z.infer<typeof notificationSchema>;
