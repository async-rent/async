import { z } from "zod";

/** Latitude/longitude pair for a physical place. */
export const geoPointSchema = z.object({
  latitude: z.number().describe("Latitude in decimal degrees."),
  longitude: z.number().describe("Longitude in decimal degrees."),
});

export type GeoPoint = z.infer<typeof geoPointSchema>;
