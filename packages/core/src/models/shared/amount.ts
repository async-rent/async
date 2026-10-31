import { z } from "zod";

export const amountSchema = z.number().int().nonnegative();
