import { z } from "zod";
import type { CustomFieldType } from "@/constants/customFieldTypes";
import { FORM_FIELD_MAX_CHARS, FORM_MAX_FIELDS } from "@/constants/formsBooking";
import { FIELD_ERRORS } from "@/constants/formsBookingStrings";
import type { CustomFieldDef } from "@/types/customFields";
import { err, ok, type Result } from "@/types/result";

// Form definitions and submission validation are pure: the caller loads the eligible custom field
// definitions once and passes them in, so every rule here is unit-testable without a database.

export const FIXED_FIELD_KEYS = [
  "name",
  "email",
  "phone",
  "organization",
  "job_title",
  "message",
  // Part 14: an optional consent checkbox. Not a custom field because it drives the marketing
  // status instead of being stored on the record.
  "marketing_consent",
] as const;

export type FixedFieldKey = (typeof FIXED_FIELD_KEYS)[number];
export type FormFieldKey = FixedFieldKey | `cf_${string}`;

export interface FormField {
  key: FormFieldKey;
  label: string;
  required: boolean;
  placeholder: string | null;
}

// Only these custom field types fit a public form: the rest need a picker or a structured editor.
export const ALLOWED_CUSTOM_FIELD_TYPES: ReadonlySet<CustomFieldType> = new Set<CustomFieldType>([
  "text",
  "large_text",
  "numeric",
  "date",
  "single_option",
]);

function isFixedFieldKey(value: string): value is FixedFieldKey {
  return (FIXED_FIELD_KEYS as readonly string[]).includes(value);
}

export function isFormFieldKey(value: string): value is FormFieldKey {
  return isFixedFieldKey(value) || /^cf_\S+$/.test(value);
}

const formFieldKeySchema = z.custom<FormFieldKey>(
  (value) => typeof value === "string" && isFormFieldKey(value),
  { message: "unknown field key" },
);

export const formFieldSchema = z.object({
  key: formFieldKeySchema,
  label: z.string().min(1).max(100),
  required: z.boolean(),
  placeholder: z.string().max(100).nullable(),
});

export const formFieldsSchema = z
  .array(formFieldSchema)
  .min(1)
  .max(FORM_MAX_FIELDS)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    for (const field of fields) {
      if (seen.has(field.key)) {
        ctx.addIssue({ code: "custom", message: `duplicate field ${field.key}` });
      }
      seen.add(field.key);
    }
    for (const key of ["name", "email"] as const) {
      const field = fields.find((f) => f.key === key);
      if (field === undefined) {
        ctx.addIssue({ code: "custom", message: `${key} is required on every form` });
      } else if (!field.required) {
        ctx.addIssue({ code: "custom", message: `${key} cannot be optional` });
      }
    }
  });

export const formDefinitionSchema = z.object({ fields: formFieldsSchema });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

interface CustomFieldResult {
  value?: string;
  error?: string;
}

function validateCustomField(def: CustomFieldDef | undefined, text: string): CustomFieldResult {
  if (def === undefined || def.archivedAt !== null) return { error: FIELD_ERRORS.unavailable };
  if (!ALLOWED_CUSTOM_FIELD_TYPES.has(def.type)) return { error: FIELD_ERRORS.unavailable };
  switch (def.type) {
    case "text":
    case "large_text":
      return { value: text };
    case "numeric":
      return NUMBER_RE.test(text) ? { value: text } : { error: FIELD_ERRORS.number };
    case "date":
      return isRealDate(text) ? { value: text } : { error: FIELD_ERRORS.date };
    case "single_option": {
      const match = def.options.find(
        (option) => option.archived !== true && (option.id === text || option.label === text),
      );
      return match === undefined ? { error: FIELD_ERRORS.option } : { value: match.id };
    }
    // Types the allow-list above already excludes. Listed so the switch stays exhaustive when a
    // new custom field type is added upstream.
    case "multi_option":
    case "autocomplete":
    case "monetary":
    case "user":
    case "org":
    case "person":
    case "phone":
    case "time":
    case "time_range":
    case "date_range":
    case "address":
      return { error: FIELD_ERRORS.unavailable };
  }
}

// Only strings and numbers have a meaningful trimmed text form; an object or array value is never
// a valid answer, so it reads as empty rather than "[object Object]".
function toText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  return "";
}

function validateField(
  field: FormField,
  raw: unknown,
  customDefs: Map<string, CustomFieldDef>,
): CustomFieldResult {
  const text = toText(raw);
  if (text === "") return field.required ? { error: FIELD_ERRORS.required } : {};
  if (text.length > FORM_FIELD_MAX_CHARS) return { error: FIELD_ERRORS.tooLong };
  if (field.key === "email") return isEmail(text) ? { value: text } : { error: FIELD_ERRORS.email };
  // Checkbox inputs submit "on"; accept the usual truthy spellings and normalise to "on" so the
  // submit handler has one value to test.
  if (field.key === "marketing_consent") {
    return ["on", "true", "1", "yes"].includes(text.toLowerCase())
      ? { value: "on" }
      : { error: FIELD_ERRORS.boolean };
  }
  if (field.key.startsWith("cf_")) {
    return validateCustomField(customDefs.get(field.key.slice(3)), text);
  }
  return { value: text };
}

/**
 * Validate raw submission values against the form's fields.
 *
 * Values are trimmed, unknown keys are dropped and every error is keyed by field so the page can
 * mark the offending input. The returned map keeps the submitted keys; the submit service maps
 * `cf_<defId>` entries to the definition's own key when writing the record.
 */
export function validateSubmission(
  fields: FormField[],
  values: Record<string, unknown>,
  customDefs: Map<string, CustomFieldDef>,
): Result<Record<string, string>, { fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {};
  const out: Record<string, string> = {};

  for (const field of fields) {
    const result = validateField(field, values[field.key], customDefs);
    if (result.error !== undefined) fieldErrors[field.key] = result.error;
    else if (result.value !== undefined) out[field.key] = result.value;
  }

  if (Object.keys(fieldErrors).length > 0) return err({ fieldErrors });
  return ok(out);
}
