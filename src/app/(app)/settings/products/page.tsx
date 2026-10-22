import type { ReactNode } from "react";
import { PageTitle } from "@/components/shell/pageTitle";
import { PRODUCTS_STRINGS } from "@/constants/salesStrings";
import { SETTINGS_STRINGS } from "@/constants/settingsStrings";
import { db } from "@/db/client";
import { readBaseCurrency } from "@/features/currency/rates";
import { supportedCurrencyCodes } from "@/features/currency/schemas";
import { ExportButton } from "@/features/export/ui/ExportButton";
import { can } from "@/features/permissions/can";
import { listProducts } from "@/features/products/products";
import { type ProductRow, ProductsSettings } from "@/features/products/ui/ProductsSettings";
import { createContext } from "@/server/trpc/context";
import { SettingsHeading } from "../SettingsHeading";
import { SettingsPage } from "../SettingsSurface";

export const metadata = { title: PRODUCTS_STRINGS.title };

// Settings > Products. Everyone signed in can read the catalog (the deal page's
// add-product combobox needs it); only products.manage may change it.
export default async function ProductsSettingsPage(): Promise<ReactNode> {
  const { actor } = await createContext();
  if (actor === null) {
    return <p className="text-sm text-destructive">{SETTINGS_STRINGS.requiresAuth}</p>;
  }

  const signal = AbortSignal.timeout(5000);
  const [rows, baseCurrency] = await Promise.all([
    listProducts(db, { includeInactive: true }, signal),
    readBaseCurrency(db, signal),
  ]);
  const products: ProductRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    unit: row.unit,
    price: row.price,
    currency: row.currency,
    taxPercent: row.taxPercent,
    active: row.active,
  }));

  return (
    <SettingsPage>
      <PageTitle title="Products" />
      <SettingsHeading
        title={PRODUCTS_STRINGS.title}
        description={PRODUCTS_STRINGS.intro}
        actions={
          can(actor, "data.export") ? (
            <ExportButton
              entity="products"
              columns={["name", "code", "unit", "price", "currency", "taxPercent", "active"]}
            />
          ) : undefined
        }
      />
      <ProductsSettings
        products={products}
        baseCurrency={baseCurrency}
        codes={supportedCurrencyCodes()}
        canManage={can(actor, "products.manage")}
      />
    </SettingsPage>
  );
}
