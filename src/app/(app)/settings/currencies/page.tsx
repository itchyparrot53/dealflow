import type { ReactNode } from "react";
import { CURRENCY_STRINGS } from "@/constants/salesStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { listRates } from "@/features/currency/rates";
import { supportedCurrencyCodes } from "@/features/currency/schemas";
import { CurrenciesSettings } from "@/features/currency/ui/CurrenciesSettings";
import { can } from "@/features/permissions/can";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: CURRENCY_STRINGS.title };

// Settings > Currencies. Uses the same permission the base-currency setting always
// used (permissions.manage), so a manager can keep rates current without being admin.
export default async function CurrenciesSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null || !can(actor, "permissions.manage")) {
    return <p className="text-sm text-red-600">{SETTINGS_STRINGS.requiresAdmin}</p>;
  }

  const rates = await listRates(db, AbortSignal.timeout(5000));
  return (
    <SettingsPage>
      <SettingsHeading title={CURRENCY_STRINGS.title} description={CURRENCY_STRINGS.intro} />
      <CurrenciesSettings base={rates.base} rates={rates.rates} codes={supportedCurrencyCodes()} />
    </SettingsPage>
  );
}
