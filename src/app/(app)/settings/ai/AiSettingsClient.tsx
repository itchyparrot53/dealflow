"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { Switch } from "@/components/ui/Switch";
import { AI_STRINGS } from "@/constants/aiStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import { updateAiSettingsAction } from "@/features/ai/actions/settingsActions";
import { formatNumber } from "@/lib/format/number";
import { readCsrfToken } from "@/utils/csrfCookie";

export interface AiSettingsOverview {
  settings: {
    enabled: boolean;
    companyMonthlyTokenLimit: number;
    userMonthlyTokenLimit: number | null;
  };
  usage: {
    companyUsed: number;
    byFeature: { feature: string; tokens: number }[];
    byUser: { userId: string; name: string; tokens: number }[];
  };
  model: string;
  providerKind: "openrouter" | "fake" | "none";
}

const format = (value: number): string => formatNumber(value);

const MESSAGES: Record<string, string> = {
  [ERROR_IDS.AI_INPUT_INVALID]: AI_STRINGS.companyLimitInvalid,
  [ERROR_IDS.PERM_DENIED]: AI_STRINGS.adminOnly,
};

function providerLine(overview: AiSettingsOverview): string {
  if (overview.providerKind === "openrouter") return AI_STRINGS.providerOpenRouter(overview.model);
  if (overview.providerKind === "fake") return AI_STRINGS.providerFake;
  return AI_STRINGS.providerNone;
}

export function AiSettingsClient({ overview }: { overview: AiSettingsOverview }): React.ReactNode {
  const router = useRouter();
  const [enabled, setEnabled] = useState(overview.settings.enabled);
  const [companyLimit, setCompanyLimit] = useState(
    String(overview.settings.companyMonthlyTokenLimit),
  );
  const [userLimit, setUserLimit] = useState(
    overview.settings.userMonthlyTokenLimit === null
      ? ""
      : String(overview.settings.userMonthlyTokenLimit),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaved(false);
    setError(null);

    const company = Number(companyLimit.trim());
    if (!Number.isInteger(company) || company < 0) {
      setError(AI_STRINGS.companyLimitInvalid);
      return;
    }
    const trimmedUser = userLimit.trim();
    const perUser = trimmedUser === "" ? null : Number(trimmedUser);
    if (perUser !== null && (!Number.isInteger(perUser) || perUser < 1)) {
      setError(AI_STRINGS.userLimitInvalid);
      return;
    }

    setSaving(true);
    try {
      const result = await updateAiSettingsAction(
        { enabled, companyMonthlyTokenLimit: company, userMonthlyTokenLimit: perUser },
        readCsrfToken(),
      );
      if (!result.ok) {
        setError(MESSAGES[result.error.id] ?? AI_STRINGS.saveError);
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const limit = overview.settings.companyMonthlyTokenLimit;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5">
        <p className="text-sm">
          <span className="font-medium">{providerLine(overview)}</span>
        </p>
        <div className="mt-4 space-y-2">
          <Progress
            value={overview.usage.companyUsed}
            max={limit > 0 ? limit : 1}
            label={AI_STRINGS.usageSummary(format(overview.usage.companyUsed), format(limit))}
          />
          <p data-testid="ai-usage-used" className="text-sm text-muted-foreground">
            {AI_STRINGS.usageSummary(format(overview.usage.companyUsed), format(limit))}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <h2 className="border-b px-5 py-3 text-sm font-semibold">{AI_STRINGS.byFeature}</h2>
        {overview.usage.byFeature.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">{AI_STRINGS.noUsage}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="px-5 py-2 font-medium">
                  {AI_STRINGS.featureColumn}
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  {AI_STRINGS.tokensColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.usage.byFeature.map((row) => (
                <tr key={row.feature} data-testid="ai-usage-feature-row" className="border-t">
                  <td className="px-5 py-2">{row.feature}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{format(row.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <h2 className="border-b px-5 py-3 text-sm font-semibold">{AI_STRINGS.byUser}</h2>
        {overview.usage.byUser.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">{AI_STRINGS.noUsage}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="px-5 py-2 font-medium">
                  {AI_STRINGS.userColumn}
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  {AI_STRINGS.tokensColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {overview.usage.byUser.map((row) => (
                <tr key={row.userId} data-testid="ai-usage-user-row" className="border-t">
                  <td className="px-5 py-2">{row.name}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{format(row.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4 rounded-lg border bg-card p-5"
      >
        <span className="flex items-center gap-2 text-sm">
          <Switch checked={enabled} onCheckedChange={setEnabled} label={AI_STRINGS.enabledLabel} />
          {AI_STRINGS.enabledLabel}
        </span>
        <FormGrid columns={2}>
          <FormField label={AI_STRINGS.companyLimitLabel} htmlFor="ai-company-limit">
            <Input
              id="ai-company-limit"
              inputMode="numeric"
              value={companyLimit}
              onChange={(event) => setCompanyLimit(event.target.value)}
              disabled={saving}
            />
          </FormField>
          <FormField label={AI_STRINGS.userLimitLabel} htmlFor="ai-user-limit">
            <Input
              id="ai-user-limit"
              inputMode="numeric"
              placeholder={AI_STRINGS.userLimitHint}
              value={userLimit}
              onChange={(event) => setUserLimit(event.target.value)}
              disabled={saving}
            />
          </FormField>
        </FormGrid>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p
            data-testid="ai-settings-saved"
            role="status"
            className="text-sm text-muted-foreground"
          >
            {AI_STRINGS.saved}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? AI_STRINGS.saving : AI_STRINGS.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
