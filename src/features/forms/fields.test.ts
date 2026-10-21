import { describe, expect, it } from "vitest";
import type { CustomFieldDef } from "@/types/customFields";
import type { Result } from "@/types/result";
import { type FormField, formDefinitionSchema, validateSubmission } from "./fields";

function def(over: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    targetEntity: "person",
    type: "text",
    name: "Budget",
    key: "budget",
    options: [],
    isRequired: false,
    isImportant: false,
    showInAddForm: false,
    order: 0,
    archivedAt: null,
    ...over,
  };
}

const NAME_FIELD: FormField = { key: "name", label: "Name", required: true, placeholder: null };
const EMAIL_FIELD: FormField = { key: "email", label: "Email", required: true, placeholder: null };
const MESSAGE_FIELD: FormField = {
  key: "message",
  label: "Message",
  required: false,
  placeholder: null,
};

function values(
  r: Result<Record<string, string>, { fieldErrors: Record<string, string> }>,
): Record<string, string> {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

function errors(
  r: Result<Record<string, string>, { fieldErrors: Record<string, string> }>,
): Record<string, string> {
  if (r.ok) throw new Error("expected failure");
  return r.error.fieldErrors;
}

describe("formDefinitionSchema", () => {
  it("accepts name and email plus optional fields", () => {
    const parsed = formDefinitionSchema.safeParse({
      fields: [NAME_FIELD, EMAIL_FIELD, MESSAGE_FIELD],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects duplicate keys", () => {
    const parsed = formDefinitionSchema.safeParse({
      fields: [NAME_FIELD, EMAIL_FIELD, { ...MESSAGE_FIELD, key: "name" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an email field", () => {
    const parsed = formDefinitionSchema.safeParse({ fields: [NAME_FIELD] });
    expect(parsed.success).toBe(false);
  });

  it("requires name", () => {
    const parsed = formDefinitionSchema.safeParse({ fields: [EMAIL_FIELD] });
    expect(parsed.success).toBe(false);
  });

  it("rejects an optional email field", () => {
    const parsed = formDefinitionSchema.safeParse({
      fields: [NAME_FIELD, { ...EMAIL_FIELD, required: false }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an optional name field", () => {
    const parsed = formDefinitionSchema.safeParse({
      fields: [{ ...NAME_FIELD, required: false }, EMAIL_FIELD],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than fifteen fields", () => {
    const fields = [NAME_FIELD, EMAIL_FIELD];
    for (let i = 0; i < 14; i += 1) {
      fields.push({ key: `cf_x${i}`, label: `Extra ${i}`, required: false, placeholder: null });
    }
    expect(formDefinitionSchema.safeParse({ fields }).success).toBe(false);
  });

  it("rejects an empty field list", () => {
    expect(formDefinitionSchema.safeParse({ fields: [] }).success).toBe(false);
  });

  it("rejects an over-long label and placeholder", () => {
    expect(
      formDefinitionSchema.safeParse({
        fields: [NAME_FIELD, EMAIL_FIELD, { ...MESSAGE_FIELD, label: "x".repeat(101) }],
      }).success,
    ).toBe(false);
    expect(
      formDefinitionSchema.safeParse({
        fields: [NAME_FIELD, EMAIL_FIELD, { ...MESSAGE_FIELD, placeholder: "x".repeat(101) }],
      }).success,
    ).toBe(false);
  });
});

describe("validateSubmission", () => {
  const fields = [NAME_FIELD, EMAIL_FIELD, MESSAGE_FIELD];

  it("trims values and drops unknown keys", () => {
    const r = validateSubmission(
      fields,
      { name: "  Sam Ortiz  ", email: " sam@example.com ", message: " Hello ", extra: "nope" },
      new Map(),
    );
    expect(values(r)).toEqual({ name: "Sam Ortiz", email: "sam@example.com", message: "Hello" });
  });

  it("rejects a missing required field", () => {
    const r = validateSubmission(fields, { email: "sam@example.com" }, new Map());
    expect(errors(r)).toHaveProperty("name");
  });

  it("rejects a bad email", () => {
    const r = validateSubmission(fields, { name: "Sam", email: "not-an-email" }, new Map());
    expect(errors(r)).toHaveProperty("email");
  });

  it("rejects a value over 2000 characters", () => {
    const r = validateSubmission(
      fields,
      { name: "Sam", email: "sam@example.com", message: "x".repeat(2001) },
      new Map(),
    );
    expect(errors(r)).toHaveProperty("message");
  });

  it("accepts a value of exactly 2000 characters", () => {
    const r = validateSubmission(
      fields,
      { name: "Sam", email: "sam@example.com", message: "x".repeat(2000) },
      new Map(),
    );
    expect(values(r).message).toHaveLength(2000);
  });

  it("treats an optional empty field as absent", () => {
    const r = validateSubmission(fields, { name: "Sam", email: "sam@example.com" }, new Map());
    expect(values(r)).toEqual({ name: "Sam", email: "sam@example.com" });
  });

  it("rejects a single-option value that is not an active option", () => {
    const budget = def({
      id: "22222222-2222-2222-2222-222222222222",
      type: "single_option",
      key: "priority",
      options: [{ id: "opt-high", label: "High" }],
    });
    const r = validateSubmission(
      [
        ...fields,
        { key: `cf_${budget.id}`, label: "Priority", required: false, placeholder: null },
      ],
      { name: "Sam", email: "sam@example.com", [`cf_${budget.id}`]: "opt-low" },
      new Map([[budget.id, budget]]),
    );
    expect(errors(r)).toHaveProperty(`cf_${budget.id}`);
  });

  it("accepts a valid single-option value", () => {
    const budget = def({
      id: "22222222-2222-2222-2222-222222222222",
      type: "single_option",
      key: "priority",
      options: [{ id: "opt-high", label: "High" }],
    });
    const r = validateSubmission(
      [...fields, { key: `cf_${budget.id}`, label: "Priority", required: true, placeholder: null }],
      { name: "Sam", email: "sam@example.com", [`cf_${budget.id}`]: "opt-high" },
      new Map([[budget.id, budget]]),
    );
    expect(values(r)[`cf_${budget.id}`]).toBe("opt-high");
  });

  it("rejects a non-numeric number field and a malformed date", () => {
    const amount = def({
      id: "33333333-3333-3333-3333-333333333333",
      type: "numeric",
      key: "amount",
    });
    const when = def({ id: "44444444-4444-4444-4444-444444444444", type: "date", key: "when" });
    const r = validateSubmission(
      [
        ...fields,
        { key: `cf_${amount.id}`, label: "Amount", required: true, placeholder: null },
        { key: `cf_${when.id}`, label: "When", required: true, placeholder: null },
      ],
      {
        name: "Sam",
        email: "sam@example.com",
        [`cf_${amount.id}`]: "twelve",
        [`cf_${when.id}`]: "31/12/2026",
      },
      new Map([
        [amount.id, amount],
        [when.id, when],
      ]),
    );
    const fieldErrors = errors(r);
    expect(fieldErrors).toHaveProperty(`cf_${amount.id}`);
    expect(fieldErrors).toHaveProperty(`cf_${when.id}`);
  });

  it("accepts numeric and ISO date custom values", () => {
    const amount = def({
      id: "33333333-3333-3333-3333-333333333333",
      type: "numeric",
      key: "amount",
    });
    const when = def({ id: "44444444-4444-4444-4444-444444444444", type: "date", key: "when" });
    const r = validateSubmission(
      [
        ...fields,
        { key: `cf_${amount.id}`, label: "Amount", required: true, placeholder: null },
        { key: `cf_${when.id}`, label: "When", required: true, placeholder: null },
      ],
      {
        name: "Sam",
        email: "sam@example.com",
        [`cf_${amount.id}`]: "1200",
        [`cf_${when.id}`]: "2026-12-31",
      },
      new Map([
        [amount.id, amount],
        [when.id, when],
      ]),
    );
    expect(values(r)).toMatchObject({
      [`cf_${amount.id}`]: "1200",
      [`cf_${when.id}`]: "2026-12-31",
    });
  });

  it("rejects a required custom field that is empty", () => {
    const budget = def({ id: "22222222-2222-2222-2222-222222222222" });
    const r = validateSubmission(
      [...fields, { key: `cf_${budget.id}`, label: "Budget", required: true, placeholder: null }],
      { name: "Sam", email: "sam@example.com" },
      new Map([[budget.id, budget]]),
    );
    expect(errors(r)).toHaveProperty(`cf_${budget.id}`);
  });

  it("rejects a custom field whose definition is gone", () => {
    const r = validateSubmission(
      [...fields, { key: "cf_missing", label: "Gone", required: true, placeholder: null }],
      { name: "Sam", email: "sam@example.com", cf_missing: "value" },
      new Map(),
    );
    expect(errors(r)).toHaveProperty("cf_missing");
  });

  it("rejects an archived definition", () => {
    const archived = def({ archivedAt: new Date("2026-01-01T00:00:00Z") });
    const r = validateSubmission(
      [...fields, { key: `cf_${archived.id}`, label: "Budget", required: true, placeholder: null }],
      { name: "Sam", email: "sam@example.com", [`cf_${archived.id}`]: "10" },
      new Map([[archived.id, archived]]),
    );
    expect(errors(r)).toHaveProperty(`cf_${archived.id}`);
  });
});
