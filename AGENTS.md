<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

<!--ASYNC ARCHITECTURE START-->

# Async Architecture Rules

Dependency direction — never violate it:

```
packages/db  <-  packages/core  <-  apps/api · apps/storefront · apps/studio · tools/mcp
```

- **`packages/db`** exports the Drizzle D1 schema only (tables + inferred types). No logic, no queries. Migration SQL is generated here by drizzle-kit — its `drizzle.config.ts` only sets the schema entry point, the dialect (`sqlite`), and the output folder (`packages/db/migrations`); no credentials, no migrator.
- **`packages/core`** is the only package with data access. No wrangler and no drizzle config — it imports the schema from `packages/db` and receives a `DrizzleD1Database`. Migrations are applied by the root `wrangler.jsonc` (`migrations_dir: "packages/db/migrations"`, then `wrangler d1 migrations apply`) — never by core or the db package. Services follow `packages/core/src/services/catalog.ts`: `create<Name>Service({ db }: Create<Name>ServiceOptions)` factory + `createResult` success/failure unions (zod-typed), exposed to apps through a single `createAsync({ db })` composition root.
- **User-facing apps compose `core` only** — never import `db`, never skip core. Each app's wrangler config binds the same D1 database (`database_id` identical everywhere; only the binding name differs) and composes `const db = drizzle(env.DATABASE); const async = createAsync({ db });`:
  - `apps/api`: core → HTTP API (Hono). Authenticated with user-created API keys.
  - `apps/storefront` / `apps/studio`: core → TanStack Start server actions. They never call the api app.
  - `tools/mcp`: core → MCP tools. Same composition as api, but authenticated with OAuth. It never calls the api app.
- Keep external providers (payments, etc.) behind interfaces defined in core; provider specifics live in sibling adapters inside core.

<!--ASYNC ARCHITECTURE END-->
