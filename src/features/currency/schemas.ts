import { z } from "zod";
import { ERROR_IDS } from "@/constants/errorIds";

// Zod schemas for money inputs. They only validate shape: the pure parsers in
// money.ts trust pre-validated strings and turn them into integer minor units.

const MONEY_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,10}(\.\d{1,8})?$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

export function supportedCurrencyCodes(): string[] {
  return [...SUPPORTED_CURRENCIES];
}

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_PATTERN.test(code) && SUPPORTED_CURRENCIES.has(code);
}

// "0" is a valid amount, so only the regex constrains moneyString.
export const moneyString = z.string().regex(MONEY_PATTERN);

export function isPositiveDecimal(s: string): boolean {
  return /[1-9]/.test(s);
}

// Accepts up to three whole digits and two decimals, including 100.00.
export function isAtMostOneHundred(s: string): boolean {
  const [wholePart, fractionPart] = s.split(".");
  const whole = wholePart ?? "0";
  const fraction = fractionPart ?? "";
  const wholeValue = BigInt(whole);
  if (wholeValue < 100n) return true;
  if (wholeValue > 100n) return false;
  return BigInt(fraction.padEnd(2, "0")) === 0n;
}

export const quantityString = z
  .string()
  .regex(QUANTITY_PATTERN)
  .refine(isPositiveDecimal, { message: "Quantity must be greater than zero." });

export const percentString = z
  .string()
  .regex(PERCENT_PATTERN)
  .refine(isAtMostOneHundred, { message: "Percent must be between 0 and 100." });

export const rateString = z
  .string()
  .regex(RATE_PATTERN)
  .refine(isPositiveDecimal, { message: "Rate must be greater than zero." });

export const currencyCode = z
  .string()
  .refine(isSupportedCurrency, { message: ERROR_IDS.CURRENCY_UNKNOWN });
