import { z } from "zod";

export const paginationSchema = <TSchema extends z.ZodType>(schema: TSchema) =>
  z.object({
    items: z.array(schema),
    total: z.number().int().nonnegative(),
  });

export type Pagination<TData> = z.infer<ReturnType<typeof paginationSchema<z.ZodType<TData>>>>;
