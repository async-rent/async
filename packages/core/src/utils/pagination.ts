import { z } from "zod";

export const paginationSchema = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.object({
    items: z.array(schema),
    total: z.number().int().nonnegative(),
    /**
     * Whether another page holds matching rows, derived from the matched-row
     * count rather than `items.length`: a page with a dropped invalid row can
     * come back short, and the list must not end there.
     */
    hasMore: z.boolean(),
  });

export type Pagination<TData> = z.infer<ReturnType<typeof paginationSchema<z.ZodType<TData>>>>;
