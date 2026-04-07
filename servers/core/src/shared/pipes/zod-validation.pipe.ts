import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import { z } from "zod";

type ZodDtoStatic<T extends z.ZodTypeAny> = {
  new (): z.output<T>;
  _schema: T;
};

/**
 * Creates a DTO class that carries a Zod schema for validation.
 * Instances of the returned class are typed as the schema's output.
 */
export function createZodDto<T extends z.ZodTypeAny>(
  schema: T,
): ZodDtoStatic<T> {
  // biome-ignore lint/complexity/noStaticOnlyClass: This class is a NestJS DTO wrapper for the Zod schema.
  const ZodDto = class {
    static readonly _schema = schema;
  };
  return ZodDto as unknown as ZodDtoStatic<T>;
}

/**
 * Global validation pipe that uses Zod schemas attached via createZodDto.
 * Replaces class-validator/class-transformer entirely.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === "custom") return value;

    const schema = (metadata.metatype as { _schema?: z.ZodTypeAny } | undefined)
      ?._schema;
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: z.flattenError(result.error),
      });
    }
    return result.data;
  }
}
