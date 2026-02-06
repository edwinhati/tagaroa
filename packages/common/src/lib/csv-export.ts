"use client";

/**
 * Options for CSV export configuration
 */
export type CsvExportOptions = {
  // Custom filename (without .csv extension)
  filename?: string;
  // Custom headers (uses object keys if not provided)
  headers?: string[];
  // Custom formatter for values
  formatValue?: (key: string, value: unknown) => string;
};

/**
 * Default filename for CSV exports
 */
const DEFAULT_FILENAME = "export";

/**
 * Escapes a CSV value by wrapping in quotes if it contains special characters
 */
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts a value to a CSV-safe string format
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Extracts headers from an array of objects
 */
function extractHeaders<T extends Record<string, unknown>>(
  data: T[],
  customHeaders?: string[],
): string[] {
  if (customHeaders && customHeaders.length > 0) {
    return customHeaders;
  }

  if (data.length === 0) {
    return [];
  }

  return Object.keys(data[0]);
}

/**
 * Converts an array of objects to CSV format
 */
function convertToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: string[],
  formatValue?: (key: string, value: unknown) => string,
): string {
  const rows: string[] = [];

  // Add header row
  rows.push(headers.map(escapeCSVValue).join(","));

  // Add data rows
  for (const item of data) {
    const values = headers.map((header) => {
      const rawValue = item[header];
      const formattedValue = formatValue
        ? formatValue(header, rawValue)
        : valueToString(rawValue);
      return escapeCSVValue(formattedValue);
    });
    rows.push(values.join(","));
  }

  return rows.join("\n");
}

/**
 * Triggers a browser download for the given CSV content
 */
function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Exports an array of objects to a CSV file and triggers download
 *
 * @param data - Array of objects to export
 * @param options - Optional configuration for filename, headers, and formatting
 *
 * @example
 * ```ts
 * // Basic usage
 * exportToCSV([
 *   { name: "Alice", age: 30, city: "New York" },
 *   { name: "Bob", age: 25, city: "Los Angeles" }
 * ], { filename: "users" });
 *
 * // With custom headers
 * exportToCSV(data, {
 *   filename: "transactions",
 *   headers: ["Date", "Description", "Amount"]
 * });
 *
 * // With custom value formatter
 * exportToCSV(data, {
 *   filename: "report",
 *   formatValue: (key, value) => {
 *     if (key === "amount") return `$${value}`;
 *     return String(value);
 *   }
 * });
 * ```
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  options: CsvExportOptions = {},
): void {
  const filename = options.filename ?? DEFAULT_FILENAME;
  const headers = extractHeaders(data, options.headers);
  const csv = convertToCSV(data, headers, options.formatValue);

  downloadCSV(csv, filename);
}
