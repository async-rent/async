import { defineConfig } from "drizzle-kit";

/**
 * Migration generation only.
 *
 * drizzle-kit reads the schema and writes SQL into `migrations/`. Applying it
 * is out of scope here: the root wrangler config owns that (`d1 migrations
 * apply`). No credentials or migrator belong in this file.
 */
export default defineConfig({
  schema: "./src/schemas/index.ts",
  dialect: "sqlite",
  out: "./migrations",
});
