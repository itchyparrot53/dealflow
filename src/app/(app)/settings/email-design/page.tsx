import { notFound, redirect } from "next/navigation";
import type React from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import { db } from "@/db/client";
import { getEmailDesign } from "@/features/email-design/design";
import { listTemplates } from "@/features/email-design/templates";
import { EmailDesignSettings } from "@/features/email-design/ui/EmailDesignSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: EMAIL_DESIGN_STRINGS.title };

// Settings > Email design. Admin only; the nav hides it for everyone else and this page is the
// boundary (notFound, the same as an invisible record).
export default async function EmailDesignSettingsPage(): Promise<React.ReactNode> {
  const { actor } = await createContext();
  if (actor === null) redirect("/login");
  if (actor.type !== "admin") notFound();
  const signal = AbortSignal.timeout(5000);
  const [design, templates] = await Promise.all([
    getEmailDesign(db, signal),
    listTemplates(db, signal),
  ]);
  return (
    <SettingsPage className="max-w-[1240px]">
      <PageTitle title={EMAIL_DESIGN_STRINGS.title} />
      <SettingsHeading
        title={EMAIL_DESIGN_STRINGS.title}
        description={EMAIL_DESIGN_STRINGS.intro}
      />
      <EmailDesignSettings initial={design} templates={templates} />
    </SettingsPage>
  );
}
