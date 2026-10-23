"use client";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { STRINGS } from "@/constants/strings";
import { updateCompanyGeneralAction } from "@/features/settings/actions";
import { readCsrfToken } from "@/utils/csrfCookie";
import { SettingsCard, SettingsCardBody, SettingsCardFooter } from "../SettingsSurface";

interface Props {
  companyName: string;
  baseCurrency: string;
}

// General tab (spec 6.1): editable company name + read-only base currency (currencies out of scope).
export function CompanyGeneralClient(props: Props): React.ReactNode {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(props.companyName);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(): Promise<void> {
    setPending(true);
    setSaved(false);
    const r = await updateCompanyGeneralAction({ companyName }, readCsrfToken());
    setPending(false);
    if (r.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <SettingsCard>
      <SettingsCardBody>
        <FormGrid columns={2}>
          <FormField label={STRINGS.settings.companyName} htmlFor="company-name">
            <Input
              id="company-name"
              aria-label={STRINGS.settings.companyName}
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setSaved(false);
              }}
            />
          </FormField>

          <FormField label={STRINGS.settings.baseCurrency}>
            <div className="flex min-h-9 items-center rounded-md bg-muted/50 px-3 text-sm text-muted-foreground">
              {props.baseCurrency}
            </div>
          </FormField>
        </FormGrid>
      </SettingsCardBody>

      <SettingsCardFooter>
        {saved ? (
          <span className="mr-auto text-sm text-muted-foreground">{STRINGS.settings.saved}</span>
        ) : null}
        <Button
          type="button"
          variant="default"
          size="sm"
          className="px-3"
          disabled={pending}
          onClick={() => void save()}
        >
          {STRINGS.settings.save}
        </Button>
      </SettingsCardFooter>
    </SettingsCard>
  );
}
