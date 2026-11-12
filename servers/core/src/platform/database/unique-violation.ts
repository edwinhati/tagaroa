import { ConflictException } from "@nestjs/common";

/** Postgres 23505, seen through Drizzle's wrapper (`cause`) or Bun SQL's `errno`. */
export const isUniqueViolation = (error: unknown): boolean => {
  const { cause, code, errno } = (error ?? {}) as {
    cause?: unknown;
    code?: unknown;
    errno?: unknown;
  };
  return (
    code === "23505" ||
    errno === "23505" ||
    (cause !== undefined && cause !== error && isUniqueViolation(cause))
  );
};

/** A pre-check can lose a race; the unique index then answers instead. */
export const conflictOnUniqueViolation = async <T>(
  write: () => Promise<T>,
  message: string,
): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new ConflictException(message);
    throw error;
  }
};
