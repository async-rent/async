import { z } from "zod";

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
