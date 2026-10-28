import { fromAny } from "@total-typescript/shoehorn";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/**
 * A real SQLite database for catalog tests.
 *
 * The service only ever sees `DrizzleD1Database`, but every driver shares the
 * same query builder. Running the queries against an in-memory SQLite database
 * built from the real migrations means the tests exercise actual SQL — joins,
 * ordering, `instr`, `exists` — instead of a hand-written mock that agrees with
 * whatever the service happens to call.
 */

const migrationsDirectory = new URL("../../db/migrations/", import.meta.url);

function applyMigrations(sqlite: DatabaseSync): void {
  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    sqlite.exec(readFileSync(new URL(migration, migrationsDirectory), "utf8"));
  }
}

export interface TestDatabase {
  db: DrizzleD1Database;
  sqlite: DatabaseSync;
  /** How many statements the service has sent so far. */
  statements: () => number;
  /** How many round trips (batches and single statements) the service has made. */
  roundTrips: () => number;
}

export function createTestDatabase(): TestDatabase {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  applyMigrations(sqlite);

  let statements = 0;
  let roundTrips = 0;

  // `sqlite-proxy` hands rows back as arrays positional to the selected
  // columns, which is what drizzle's row mapper expects.
  const execute = (query: string, params: unknown[], method: string) => {
    statements += 1;

    const statement = sqlite.prepare(query);

    if (method === "run") {
      statement.run(...(params as never[]));

      return { rows: [] };
    }

    const columns = statement.columns().map((column) => column.name);
    const rows = statement.all(...(params as never[])) as Record<string, unknown>[];
    const values = rows.map((row) => columns.map((name) => row[name]));

    return { rows: method === "get" ? values.slice(0, 1) : values };
  };

  const proxy = drizzle(
    async (query, params, method) => {
      roundTrips += 1;

      return execute(query, params, method);
    },
    // Mirror D1: a batch is one transaction, and a failed statement rolls the
    // whole sequence back.
    async (batch) => {
      roundTrips += 1;

      sqlite.exec("begin");

      try {
        const results = batch.map(({ sql, params, method }) => execute(sql, params, method));
        sqlite.exec("commit");

        return results;
      } catch (error) {
        sqlite.exec("rollback");
        throw error;
      }
    },
  );

  const db: DrizzleD1Database = fromAny(proxy);

  return {
    db,
    sqlite,
    statements: () => statements,
    roundTrips: () => roundTrips,
  };
}
