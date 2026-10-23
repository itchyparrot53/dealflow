"use client";

import type React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import type { EmailDesignView } from "@/features/email-design/design";
import type { TemplateListItem } from "@/features/email-design/templates";
import { BrandingTab } from "./BrandingTab";
import { TemplatesTab } from "./TemplatesTab";

export function EmailDesignSettings({
  initial,
  templates,
}: {
  initial: EmailDesignView;
  templates: TemplateListItem[];
}): React.ReactNode {
  return (
    <Tabs defaultValue="branding" className="space-y-4">
      <TabsList aria-label={EMAIL_DESIGN_STRINGS.title}>
        <TabsTrigger value="branding">{EMAIL_DESIGN_STRINGS.brandingTab}</TabsTrigger>
        <TabsTrigger value="templates">{EMAIL_DESIGN_STRINGS.templatesTab}</TabsTrigger>
      </TabsList>
      <TabsContent value="branding" className="pt-2">
        <BrandingTab initial={initial} />
      </TabsContent>
      <TabsContent value="templates" className="pt-2">
        <TemplatesTab templates={templates} />
      </TabsContent>
    </Tabs>
  );
}
