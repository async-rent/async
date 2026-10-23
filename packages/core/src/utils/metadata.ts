import { z } from "zod";

/** Free-form metadata bag for integration-specific fields. */
export const metadataSchema = z.record(z.string(), z.unknown());

export type Metadata = z.infer<typeof metadataSchema>;
