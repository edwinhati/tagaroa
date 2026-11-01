import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType, output } from "zod";

/**
 * Parses a request value with a Zod schema, so a handler receives the shape it
 * declares. A failure is a 400 whose `message` is the first issue's sentence
 * (what `messageFor` reads in the apps) and whose `details` list every issue by
 * field, for a form that wants to show them beside the input.
 */
export class ZodBody<S extends ZodType> implements PipeTransform<
  unknown,
  output<S>
> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const { issues } = result.error;
    throw new BadRequestException({
      details: issues.map(({ message, path }) => ({
        field: path.map(String).join("."),
        message,
      })),
      error: "Bad Request",
      message: issues[0]!.message,
      statusCode: 400,
    });
  }
}
