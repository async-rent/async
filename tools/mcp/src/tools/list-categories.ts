import type { Category } from "@async-rent/core";
import { categorySchema } from "@async-rent/core";
import { z } from "zod";
import type { Tool } from "../shared/tools";
import { toToolResult } from "../shared/tools";

const outputSchema = z.object({ categories: z.array(categorySchema) });

type Output = z.infer<typeof outputSchema>;

const toOutput = (categories: Category[]): Output => ({ categories });

export const listCategories: Tool = (server, { async }) => {
  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description:
        "List the kinds of workspace equipment Async rents, such as desks, chairs and lighting, in menu order. Use a category's id to filter search_products.",
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async () => toToolResult(await async.catalog.listCategories(), toOutput),
  );
};
