import { z } from "zod";

/**
 * A result is the outcome of an operation expressed as plain data, never a
 * thrown error. Callers branch on `success` instead of wrapping calls in
 * try/catch, so every failure a service can produce is visible in its type.
 *
 * A failure carries a stable `code` to branch on and a `message` safe to show
 * to a user. It may also carry the original `cause` so a swallowed database or
 * provider error keeps its stack and context instead of vanishing.
 */

export type ResultError<TCode extends string = string> = {
  code: TCode;
  message: string;
  cause?: unknown;
};

/** `{ success: true }` — an operation that returns nothing. */
export type Ok = { success: true };

/** `{ success: true, data }` — an operation that returns a value. */
export type OkWith<TData> = { success: true; data: TData };

/** `{ success: false, error }` — an operation that failed. */
export type Err<TCode extends string> = { success: false; error: ResultError<TCode> };

/**
 * The result of an operation. A `void` operation succeeds without `data`;
 * anything else succeeds with a payload.
 */
export type Result<TData, TCode extends string> =
  | ([TData] extends [void] ? Ok : OkWith<TData>)
  | Err<TCode>;

/**
 * The success constructor: no argument for `void`, the payload otherwise. The
 * tuple stops the conditional distributing over a union payload, which would
 * otherwise turn `ok` into a union of functions that accepts nothing.
 */
type OkFactory<TData> = [TData] extends [void] ? () => Ok : (data: TData) => OkWith<TData>;

/**
 * A result constructor pair for one operation.
 *
 * `ok` builds the success branch (parsing the payload against `dataSchema`, so
 * a service can never return a shape its own schema rejects). `err` builds a
 * failure from a known code. `schema` is the zod schema of the whole union,
 * exported so a consumer that chooses to validate a boundary can.
 */
export interface ResultFactory<TData, TCode extends string> {
  schema: z.ZodType<Result<TData, TCode>>;
  ok: OkFactory<TData>;
  err: (code: TCode, message: string, cause?: unknown) => Err<TCode>;
}

function okResultSchema<TSchema extends z.ZodType>(dataSchema: TSchema) {
  if (dataSchema.type === "void") {
    return z.object({ success: z.literal(true) });
  }

  return z.object({ success: z.literal(true), data: dataSchema });
}

function errResultSchema<TCodeSchema extends z.ZodType<string>>(codeSchema: TCodeSchema) {
  return z.object({
    success: z.literal(false),
    error: z.object({
      code: codeSchema,
      message: z.string(),
      cause: z.unknown().optional(),
    }),
  });
}

export function createResult<TSchema extends z.ZodType, TCodeSchema extends z.ZodType<string>>(
  dataSchema: TSchema,
  codeSchema: TCodeSchema,
): ResultFactory<z.infer<TSchema>, z.infer<TCodeSchema>> {
  const schema = z.discriminatedUnion("success", [
    okResultSchema(dataSchema),
    errResultSchema(codeSchema),
  ]);

  const ok = (
    dataSchema.type === "void"
      ? () => ({ success: true })
      : (data: z.infer<TSchema>) => ({ success: true, data: dataSchema.parse(data) })
  ) as OkFactory<z.infer<TSchema>>;

  const err = (
    code: z.infer<TCodeSchema>,
    message: string,
    cause?: unknown,
  ): Err<z.infer<TCodeSchema>> => ({
    success: false,
    error: cause === undefined ? { code, message } : { code, message, cause },
  });

  return {
    schema: schema as unknown as ResultFactory<z.infer<TSchema>, z.infer<TCodeSchema>>["schema"],
    ok,
    err,
  };
}

/** The outcome of running a promise without letting it throw. */
export type Attempt<TValue> = { ok: true; value: TValue } | { ok: false; error: unknown };

/**
 * Runs a promise and captures its rejection instead of letting it throw.
 *
 * This replaces the pattern of `.catch(() => null)`, which threw away the
 * reason a database call failed and left every failure indistinguishable. The
 * caller gets the error back and maps it to a typed failure, keeping the cause
 * for logs: `const read = await attempt(db.select()...); if (!read.ok) return err("...", "...", read.error);`
 */
export async function attempt<TValue>(promise: Promise<TValue>): Promise<Attempt<TValue>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}
