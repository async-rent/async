import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/**
 * Timestamp columns shared by every table.
 *
 * Stored as Unix epoch milliseconds (integer) instead of ISO strings: cheaper
 * to store, sort and index in SQLite. Core converts them to the ISO dates its
 * schemas expect.
 */
export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
};
