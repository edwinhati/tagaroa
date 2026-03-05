import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { ZodSchema, z } from "zod";

type ZodDtoStatic<T extends ZodSchema> = {
  new (): z.output<T>;
  _schema: T;
};

/**
 * Creates a DTO class that carries a Zod schema for validation.
 * Instances of the returned class are typed as the schema's output.
 */
export function createZodDto<T extends ZodSchema>(schema: T): ZodDtoStatic<T> {
  const ZodDto = class {};
  return Object.assign(ZodDto, {
    _schema: schema,
  }) as unknown as ZodDtoStatic<T>;
}

/**
 * Global validation pipe that uses Zod schemas attached via createZodDto.
 * Replaces class-validator/class-transformer entirely.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === "custom") return value;

    const schema = (metadata.metatype as { _schema?: ZodSchema } | undefined)
      ?._schema;
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}
