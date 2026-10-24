import { sql } from "drizzle-orm";

/**
 * The values an `in (...)` check should accept, as a SQL literal list.
 *
 * The check constraints are derived from the same arrays as the column types,
 * so the literals exist in exactly one place. SQLite rejects bound parameters
 * inside a check constraint, hence the inlined literals.
 */
export function enumValuesSql(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}
