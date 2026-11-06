import {
  type ArgumentMetadata,
  BadRequestException,
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from "@nestjs/common";

type Issues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions["exceptionFactory"]>
>[0];

/** Any Standard Schema: Zod, Valibot, ArkType. */
type Schema = NonNullable<ArgumentMetadata["schema"]>;

/** What a schema produces, as `StandardSchemaV1.InferOutput` spells it. */
type Output<S extends Schema> = NonNullable<S["~standard"]["types"]>["output"];

/**
 * A failure is a 400 whose `message` is the first issue's sentence (what
 * `messageFor` reads in the apps) and whose `details` list every issue by
 * field, for a form that wants to show them beside the input.
 */
const invalidInput = (issues: Issues): BadRequestException =>
  new BadRequestException({
    details: issues.map(({ message, path = [] }) => ({
      field: path
        .map((segment) =>
          String(typeof segment === "object" ? segment.key : segment),
        )
        .join("."),
      message,
    })),
    error: "Bad Request",
    message: issues[0]?.message ?? "Bad Request",
    statusCode: 400,
  });

/**
 * Nest's own pipe for `@Body({ schema })`, `@Query({ schema })` and
 * `@Param(name, { schema })`, with this service's 400. Bound once as
 * `APP_PIPE` in `AppModule`: a parameter that declares no schema passes
 * through untouched, and one that does is never reached unparsed. It also
 * strips `__proto__`, `prototype` and `constructor` keys before parsing.
 *
 * The schema on a decorator is only metadata. A module that mounts a
 * controller without `AppModule` (a test, a second entrypoint) must bind this
 * pipe too, or its handlers receive the raw value.
 */
export const schemaValidation = new StandardSchemaValidationPipe({
  exceptionFactory: invalidInput,
});

/**
 * The same parse and the same 400, for a value a handler reads by hand: a
 * signed webhook body, which must not be parsed before its signature passes.
 */
export const parseWith = async <S extends Schema>(
  schema: S,
  value: unknown,
): Promise<Output<S>> =>
  (await schemaValidation.transform(value, {
    schema,
    type: "body",
  })) as Output<S>;
