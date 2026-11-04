/**
 * Reads a JSON column that the driver may return either as a string
 * (MariaDB / older MySQL) or already parsed (MySQL JSON type). Never throws:
 * malformed or empty data falls back to `fallback`.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}
