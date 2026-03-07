export function normalizeBudgetItemId(
  value?: string | null,
): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "none") {
    return undefined;
  }

  return trimmed;
}
