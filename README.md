<div align="center">
  <img height="120x" src="assets/logo.svg" />

  <h1 style="margin-top: 12px;">Async</h1>

  <p>
    <a href="https://async.rent"><img alt="Website" src="https://img.shields.io/badge/website-async.rent-blue" /></a>
    <a href="https://docs.async.rent"><img alt="Docs" src="https://img.shields.io/badge/docs-docs.async.rent-blue" /></a>
  </p>
</div>

**Async** is a rental marketplace for workspace equipment (standing desks, ergonomic chairs, monitors, monitor arms, keyboards, lamps, plants) in digital nomad hubs — Bali, Chiang Mai, Da Nang, Lisbon.

## Products

- **Storefront**: The conventional way in — a user-facing rental e-commerce site to browse the catalog, filter by city and category, compare weekly prices, and rent in a few clicks.
- **Studio**: Instead of scrolling a product catalog, the user **composes their dream setup in an interactive isometric room designer**, watches the weekly price build up live, and hits **Rent** when they're happy.
- **MCP**: AI-native, so any AI agent (Claude, ChatGPT, Cursor) can search gear, design a setup, create a reservation, and pay — "set me up in Bali under $400/month, make it cozy" becomes a single prompt.

## Personas & jobs-to-be-done

| Persona                                       | Situation                                                                                          | Job to be done                                                                                       | What they'd pay                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **The landed freelancer** (primary)           | Just arrived in Canggu, Airbnb has a dining-table "desk", laptop neck by day 3, client call Monday | Get an ergonomic, inspiring workspace within 24h — without buying gear they'll abandon in 2 months   | $80–300/mo                                                            |
| **The agent user** (AI-native)                | Lives in Claude/Cursor/ChatGPT; delegates logistics to agents                                      | "Just handle my setup" — search, decide, book, pay, track delivery inside their existing AI workflow | Same, with higher conversion & AOV (agent upsells insurance, add-ons) |
| **The gear owner / local shop** (supply side) | Coworking space, villa manager, rental shop with idle inventory                                    | Monetize idle stock with zero storefront effort                                                      | Wants ~80% of rent (monis's marketplace rate validates this)          |

## Seeds

Apply the schema migrations, then seed the catalog:

```sh
vp exec wrangler d1 migrations apply async-rent --local
vp exec wrangler d1 execute     async-rent --local  --file=packages/db/seed.sql

vp exec wrangler d1 migrations apply async-rent --remote
vp exec wrangler d1 execute     async-rent --remote --file=packages/db/seed.sql
```

The seed is idempotent and safe to re-run — it upserts catalog rows and
never touches carts, rentals, payments or billing agreements.
