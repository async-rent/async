import { z } from "zod";

/**
 * Result: the outcome of an operation as plain data instead of a thrown error.
 *
 * A failed result carries a stable `code` to branch on and a `message` that is
 * safe to show to the user. A successful result may carry a payload.
 */

/** The error branch shared by every failed result. */
export const resultErrorSchema = z.object({
  code: z.string().describe('Stable error code, e.g. "rental_not_found".'),
  message: z.string().describe("Human-readable message safe to show to the user."),
});

export type ResultError<TErrorCode extends string = string> = {
  code: TErrorCode;
  message: string;
};

/** A failed error branch whose `code` is narrowed to the given schema. */
export function createResultErrorSchema<TErrorCodeSchema extends z.ZodType<string>>(
  errCodeSchema: TErrorCodeSchema,
) {
  return z.object({
    code: errCodeSchema,
    message: z.string().describe("Human-readable message safe to show to the user."),
  });
}

/** `{ success: true }` — the result of an operation with nothing to return. */
export const successResultSchema = z.object({
  success: z.literal(true),
});

export type SuccessResult = z.infer<typeof successResultSchema>;

/** `{ success: true, data }` — the result of an operation that returns data. */
export function createSuccessResultSchema<TDataSchema extends z.ZodType>(dataSchema: TDataSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export type SuccessWithDataResult<TData> = {
  success: true;
  data: TData;
};

/** `{ success: false, error: { code, message } }`. */
export function createFailedResultSchema<TErrorCodeSchema extends z.ZodType<string>>(
  errCodeSchema: TErrorCodeSchema,
) {
  return z.object({
    success: z.literal(false),
    error: createResultErrorSchema(errCodeSchema),
  });
}

export type FailedResult<TErrorCode extends string> = {
  success: false;
  error: ResultError<TErrorCode>;
};

/** A success carrying `schema`, or a failure carrying one of the error codes. */
export function createResultSchema<
  TDataSchema extends z.ZodType,
  TErrorCodeSchema extends z.ZodType<string>,
>(dataSchema: TDataSchema, errCodeSchema: TErrorCodeSchema) {
  return z.discriminatedUnion("success", [
    dataSchema.type === "void" ? successResultSchema : createSuccessResultSchema(dataSchema),
    createFailedResultSchema(errCodeSchema),
  ]);
}

/**
 * The result type, kept as a plain type because it switches on whether `TData`
 * is `void`: a void operation succeeds without a `data` key.
 */
export type Result<TData, TErrorCode extends string> =
  | (TData extends void ? SuccessResult : SuccessWithDataResult<TData>)
  | FailedResult<TErrorCode>;

/**
 * The success branch: an operation with `void` data succeeds without a
 * payload, anything else succeeds with a parsed payload.
 */
export type SuccessResultFactory<TData> = TData extends void
  ? () => SuccessResult
  : (data: TData) => SuccessWithDataResult<TData>;

export function successResult<TSchema extends z.ZodType>(
  schema: TSchema,
): SuccessResultFactory<z.infer<TSchema>> {
  const success = true;

  if (schema.type === "void") {
    return (() => ({ success })) as unknown as SuccessResultFactory<z.infer<TSchema>>;
  }

  return ((data: z.infer<TSchema>) => ({
    success,
    data: schema.parse(data),
  })) as unknown as SuccessResultFactory<z.infer<TSchema>>;
}

export function failedResult<TErrorCodeSchema extends z.ZodType<string>>(
  _schema: TErrorCodeSchema,
) {
  return (
    code: z.infer<TErrorCodeSchema>,
    message: string,
  ): FailedResult<z.infer<TErrorCodeSchema>> => ({
    success: false,
    error: { code, message },
  });
}

export interface ResultFactory<TData, TErrorCode extends string> {
  schema: z.ZodType<Result<TData, TErrorCode>>;
  success: SuccessResultFactory<TData>;
  failed: (code: TErrorCode, message: string) => FailedResult<TErrorCode>;
}

export function createResult<TSchema extends z.ZodType, TErrorCodeSchema extends z.ZodType<string>>(
  dataSchema: TSchema,
  errCodeSchema: TErrorCodeSchema,
): ResultFactory<z.infer<TSchema>, z.infer<TErrorCodeSchema>> {
  const schema = createResultSchema(dataSchema, errCodeSchema);
  const success = successResult(dataSchema);
  const failed = failedResult(errCodeSchema);

  return {
    schema: schema as unknown as ResultFactory<
      z.infer<TSchema>,
      z.infer<TErrorCodeSchema>
    >["schema"],
    success,
    failed,
  };
}
