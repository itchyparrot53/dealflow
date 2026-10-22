"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FORM_COPY } from "@/constants/formsBookingStrings";
import type { FormField } from "../fields";

// The visitor-facing form. It renders as a real HTML form that posts to the public route, so it
// works with JavaScript disabled (the route answers 303 back with ?done=1); the submit handler
// upgrades that to an inline fetch that can mark individual fields.

const INPUT_TYPES: Record<string, string> = {
  email: "email",
  phone: "tel",
  name: "text",
  organization: "text",
  job_title: "text",
};

interface SubmitResponse {
  ok?: boolean;
  message?: string;
  redirectUrl?: string | null;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export function PublicForm({
  publicId,
  title,
  description,
  fields,
  successMessage,
  token,
  initiallyDone,
}: {
  publicId: string;
  title: string;
  description: string | null;
  fields: FormField[];
  successMessage: string;
  token: string;
  initiallyDone: boolean;
}): React.ReactNode {
  const [values, setValues] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(initiallyDone);
  const [submitting, setSubmitting] = useState(false);

  function setValue(key: string, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setMessage(null);

    let response: Response;
    try {
      response = await fetch(`/api/public/forms/${publicId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, website, token }),
      });
    } catch {
      setSubmitting(false);
      setMessage("Could not reach the server. Please try again.");
      return;
    }
    setSubmitting(false);

    const body = (await response.json().catch(() => ({}))) as SubmitResponse;
    if (response.status === 200 && body.ok === true) {
      if (typeof body.redirectUrl === "string" && body.redirectUrl !== "") {
        window.location.assign(body.redirectUrl);
        return;
      }
      setDone(true);
      return;
    }
    if (response.status === 422 && body.fieldErrors !== undefined) {
      setErrors(body.fieldErrors);
      setMessage(FORM_COPY.invalidSubmission);
      return;
    }
    if (response.status === 429) {
      setMessage(FORM_COPY.rateLimited);
      return;
    }
    if (response.status === 404) {
      setMessage(FORM_COPY.unavailable);
      return;
    }
    setMessage(FORM_COPY.invalidSubmission);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-6 px-6 py-12 text-foreground">
      <div className="rounded-lg border border-border bg-card p-8">
        <header className="space-y-2">
          <h1 className="text-title">{title}</h1>
          {description === null || description.trim() === "" ? null : (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </header>

        {done ? (
          <p
            className="rounded-md bg-muted px-4 py-3 text-sm"
            data-testid="public-form-success"
            role="status"
          >
            {successMessage}
          </p>
        ) : (
          <form
            method="post"
            action={`/api/public/forms/${publicId}/submit`}
            onSubmit={(event) => void submit(event)}
            className="space-y-4"
            data-testid="public-form"
          >
            {fields.map((field) => (
              <div
                key={field.key}
                className="space-y-1"
                data-testid="public-form-field"
                data-key={field.key}
              >
                <label htmlFor={`field-${field.key}`} className="block text-sm font-medium">
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </label>
                {field.key === "message" ? (
                  <Textarea
                    id={`field-${field.key}`}
                    name={field.key}
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    rows={4}
                    maxLength={2000}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                ) : (
                  <Input
                    id={`field-${field.key}`}
                    name={field.key}
                    type={INPUT_TYPES[field.key] ?? "text"}
                    required={field.required}
                    placeholder={field.placeholder ?? undefined}
                    maxLength={field.key === "email" ? 320 : 2000}
                    value={values[field.key] ?? ""}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                )}
                {errors[field.key] === undefined ? null : (
                  <p className="text-xs text-destructive">{errors[field.key]}</p>
                )}
              </div>
            ))}

            <div aria-hidden="true" className="hidden">
              <label htmlFor="public-form-website">
                Website
                <input
                  id="public-form-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </label>
            </div>
            <input type="hidden" name="token" value={token} />

            {message === null ? null : (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              data-testid="public-form-submit"
              className="w-full"
            >
              Submit
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
