import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import type { FormField } from "@/features/forms/fields";
import { issueFormToken } from "@/features/forms/spamToken";
import { loadPublicForm } from "@/features/forms/submit";

// The public form page. Minimal markup in this task; Task 3.2 replaces it with the styled
// PublicForm component and the PoweredBy footer. It works without JavaScript: the form posts to
// the route, which answers 303 back here with ?done=1.

export const dynamic = "force-dynamic";

// The compiler treats Date.now() inside a component as an impure render; this server page needs
// the real clock (a fresh token per request), so the read is isolated in a module function.
function issuedAt(): number {
  return Date.now();
}

const INPUT_TYPES: Record<string, string> = {
  email: "email",
  phone: "tel",
  name: "text",
  organization: "text",
  job_title: "text",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const publicForm = await loadPublicForm(db, publicId, AbortSignal.timeout(5000));
  return { title: publicForm?.form.title ?? "Form not available" };
}

export default async function PublicFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ done?: string }>;
}): Promise<React.ReactNode> {
  const { publicId } = await params;
  const { done } = await searchParams;
  const publicForm = await loadPublicForm(db, publicId, AbortSignal.timeout(5000));
  if (publicForm === null) notFound();
  const form = publicForm.form;
  const fields = form.fields as FormField[];
  const token = issueFormToken(publicId, issuedAt());

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-6 bg-white px-6 py-12 text-slate-900">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{form.title}</h1>
        {form.description !== null && form.description.trim() !== "" ? (
          <p className="text-sm text-slate-600">{form.description}</p>
        ) : null}
      </header>

      {done === "1" ? (
        <p className="rounded-md bg-slate-100 px-4 py-3 text-sm" data-testid="public-form-success">
          {form.successMessage}
        </p>
      ) : (
        <form
          method="post"
          action={`/api/public/forms/${publicId}/submit`}
          className="space-y-4"
          data-testid="public-form"
        >
          {fields.map((field) => (
            <label
              key={field.key}
              htmlFor={`field-${field.key}`}
              className="block space-y-1"
              data-testid="public-form-field"
              data-key={field.key}
            >
              <span className="text-sm font-medium">
                {field.label}
                {field.required ? <span className="text-red-600"> *</span> : null}
              </span>
              {field.key === "message" ? (
                <textarea
                  id={`field-${field.key}`}
                  name={field.key}
                  required={field.required}
                  placeholder={field.placeholder ?? undefined}
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              ) : (
                <input
                  id={`field-${field.key}`}
                  name={field.key}
                  type={INPUT_TYPES[field.key] ?? "text"}
                  required={field.required}
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.key === "email" ? 320 : 2000}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </label>
          ))}

          <div aria-hidden="true" className="hidden">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            data-testid="public-form-submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Submit
          </button>
        </form>
      )}
    </main>
  );
}
