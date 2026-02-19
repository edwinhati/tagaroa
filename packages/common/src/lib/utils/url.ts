export function buildSearchParams(
  // biome-ignore lint/suspicious/noExplicitAny: generic params
  params: Record<string, any>,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        // Filter out empty strings/nulls from array
        const validValues = value.filter(
          (v) => v !== undefined && v !== null && v !== "",
        );
        if (validValues.length > 0) {
          searchParams.append(key, validValues.join(","));
        }
      }
    } else if (value instanceof Date) {
      searchParams.append(key, value.toISOString());
    } else {
      searchParams.append(key, String(value));
    }
  }

  return searchParams;
}
