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
packages/db  <-  packages/core  <-  packages/payment  <-  apps/api · apps/storefront · apps/studio · tools/mcp
```

Apps import `packages/core` directly as well; `packages/payment` only adds the provider adapters they compose into it.

- **`packages/db`** exports the Drizzle D1 schema only (tables + inferred types). No logic, no queries. Migration SQL is generated here by drizzle-kit — its `drizzle.config.ts` only sets the schema entry point, the dialect (`sqlite`), and the output folder (`packages/db/migrations`); no credentials, no migrator.
- **`packages/core`** is the only package with data access. No wrangler and no drizzle config — it imports the schema from `packages/db` and receives a `DrizzleD1Database`. Migrations are applied by the root `wrangler.jsonc` (`migrations_dir: "packages/db/migrations"`), which owns one D1 database per environment — `async-rent` (default), `async-rent_dev`, `async-rent_staging` — via `wrangler d1 migrations apply <database_name> --local/--remote` (`--env dev` / `--env staging` for the latter two). Never by core or the db package. Services follow `packages/core/src/services/catalog.ts`: `create<Name>Service({ db }: Create<Name>ServiceOptions)` factory + `createResult` success/failure unions (zod-typed), exposed to apps through a single `createAsync({ db })` composition root.
- **User-facing apps compose `core`**, plus the `packages/payment` adapters they pass into it — never import `db`, never skip core. Each app's wrangler config binds the same D1 database per environment (`database_id` identical across apps for a given environment; only the binding name differs) and composes `const db = drizzle(env.DATABASE); const async = createAsync({ db, paymentProviders });`:
  - `apps/api`: core → HTTP API (Hono). Authenticated with user-created API keys.
  - `apps/storefront` / `apps/studio`: core → TanStack Start server actions. They never call the api app.
  - `tools/mcp`: core → MCP tools. Same composition as api, but authenticated with OAuth. It never calls the api app.
- Keep external providers (payments, etc.) behind interfaces defined in core. Payment provider specifics live in `packages/payment`, one sibling file per provider (`src/paypal.ts`), each implementing core's `PaymentProviderAdapter` from a `create<Provider>Adapter(options)` factory. That package has no data access, never imports `packages/db`, and is the only place a provider's SDK or REST calls appear. Provider credentials come from Worker secrets and are passed to the factory; apps compose `createAsync({ db, paymentProviders: { paypal: createPayPalAdapter({ ... }) } })`.

<!--ASYNC ARCHITECTURE END-->

<!--ASYNC STACKED PRS START-->

# Stacked PR Rules

Dependent work ships as a stack — never one big PR, never a branch cut by hand off another feature branch. One issue = one branch = one PR = one stack layer. Trunk is `main`; branches are `feat/<issue>-<slug>` (e.g. `feat/4-cart-rental-payment-tables`). An issue's "Blocked by" line _is_ the stack order.

`gh stack` owns every stack operation:

| Step                                                   | Command                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| Adopt existing branches / start a stack (bottom → top) | `gh stack init <branch...>`                                                 |
| Add a layer on top of the current one                  | `gh stack add <branch>`                                                     |
| Push and create/update the PRs                         | `gh stack submit --open`                                                    |
| Fix a lower layer after review                         | `gh stack checkout <branch>` → commit → `gh stack rebase` → `gh stack push` |
| Merge the stack (bottom-up, retargets the rest)        | `gh stack merge`                                                            |
| Link branches that already have PRs                    | `gh stack link <branch...>`                                                 |

- Start the next layer as soon as the bottom PR is open — review never blocks progress. Note the relation in the PR body (`Stacked on #N`).
- Only stack on a layer that already passes `vp check` and `vp test`: each layer is reviewed on its own, so it must stand alone.
- Never hand-edit a PR's base branch, `git push --force` a stack branch, or merge a layer out of order. `gh stack` retargets bases, force-pushes with lease, and merges bottom-up — use `gh stack push`, not `git push -f`.
- Schema migrations: when a lower layer changes the schema, regenerate its migration there, then rebase and regenerate the upper layer's migration against the new baseline (drop the stale `NNNN_*.sql` and its `meta/` journal entry first). Rebase fixes history, not SQL.
- `gh stack add -A` stages untracked files. Name the branch and use `-u`, so stray notes never land in a layer.
- **Title**: `type(scope): action` — user-focused, present tense, Conventional Commits format.
  - Good: `docs: protect client funds from unauthorized contractor custody`
  - Bad: `Add FUND_HANDLING.md`

<!--ASYNC STACKED PRS END-->
