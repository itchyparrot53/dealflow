// Document numbers are assigned at issue from a per-kind, per-year counter. The
// format is fixed here so the service and the tests agree on the printed value.

const MIN_DIGITS = 4;

export function formatDocNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(MIN_DIGITS, "0")}`;
}
