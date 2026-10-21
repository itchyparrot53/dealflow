import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import type { FormField } from "@/features/forms/fields";
import { issueFormToken } from "@/features/forms/spamToken";
import { loadPublicForm } from "@/features/forms/submit";
import { PublicForm } from "@/features/forms/ui/PublicForm";
import { PoweredBy } from "@/features/public/PoweredBy";

// The public form page. It is rendered outside the app shell, works without JavaScript (the form
// posts to the route, which answers 303 back here with ?done=1), and may be framed on any site.

export const dynamic = "force-dynamic";

// React treats Date.now() in a component as impure; this server page needs a fresh token per
// request, so the clock read is isolated in a module function.
function issuedAt(): number {
  return Date.now();
}

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicForm
        publicId={publicId}
        title={form.title}
        description={form.description}
        fields={form.fields as FormField[]}
        successMessage={form.successMessage}
        token={issueFormToken(publicId, issuedAt())}
        initiallyDone={done === "1"}
      />
      <PoweredBy />
    </div>
  );
}
