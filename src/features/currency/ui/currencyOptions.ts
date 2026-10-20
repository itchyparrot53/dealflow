import type { SelectOption } from "@/components/ui/Select";

// Intl is the only currency catalog we ship, so labels stay in sync with the codes
// the server validates against. "en" is explicit so server and client render alike.
const NAMES = new Intl.DisplayNames(["en"], { type: "currency" });

export function currencyName(code: string): string {
  return NAMES.of(code) ?? code;
}

export function currencyLabel(code: string): string {
  return `${code}, ${currencyName(code)}`;
}

export function currencyOptions(codes: readonly string[]): SelectOption[] {
  return codes.map((code) => ({ value: code, label: currencyLabel(code) }));
}
