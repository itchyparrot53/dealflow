"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import {
  SETTINGS_TABLE_CELL,
  SETTINGS_TABLE_HEAD,
  SETTINGS_TABLE_HEADER_CELL,
  SETTINGS_TABLE_ROW,
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
} from "@/app/(app)/settings/SettingsSurface";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { currencyMinorDigits, formatMoney } from "@/lib/format/number";
import { ERROR_IDS } from "@/constants/errorIds";
import { PRODUCTS_STRINGS } from "@/constants/salesStrings";
import { deleteProductAction, setProductActiveAction } from "@/features/products/actions";
import { readCsrfToken } from "@/utils/csrfCookie";
import { ProductDialog, type ProductFormValues } from "./ProductDialog";

const S = PRODUCTS_STRINGS;

export interface ProductRow {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  price: string;
  currency: string;
  taxPercent: string;
  active: boolean;
}

interface Props {
  products: ProductRow[];
  baseCurrency: string;
  codes: string[];
  canManage: boolean;
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.PRODUCT_IN_USE:
      return S.inUse;
    case ERROR_IDS.PRODUCT_NOT_FOUND:
      return S.notFound;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.saveFailed;
  }
}

function toForm(row: ProductRow): ProductFormValues {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    unit: row.unit,
    price: row.price,
    currency: row.currency,
    taxPercent: row.taxPercent,
  };
}

export function ProductsSettings({
  products,
  baseCurrency,
  codes,
  canManage,
}: Props): React.ReactNode {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Remount the dialog on every open so its form always starts from the current row.
  const [dialogKey, setDialogKey] = useState(0);
  const [editing, setEditing] = useState<ProductFormValues | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProductRow | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const visible = products.filter((row) => {
    if (!includeArchived && !row.active) return false;
    if (query === "") return true;
    return row.name.toLowerCase().includes(query) || (row.code ?? "").toLowerCase().includes(query);
  });

  function openNew(): void {
    setEditing(null);
    setDialogKey((current) => current + 1);
    setDialogOpen(true);
  }

  function openEdit(row: ProductRow): void {
    setEditing(toForm(row));
    setDialogKey((current) => current + 1);
    setDialogOpen(true);
  }

  async function toggleActive(row: ProductRow): Promise<void> {
    setPending(true);
    setError(null);
    const result = await setProductActiveAction(
      { id: row.id, active: !row.active },
      readCsrfToken(),
    );
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    router.refresh();
  }

  async function confirmDelete(): Promise<void> {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target === null) return;
    setPending(true);
    setError(null);
    const result = await deleteProductAction(target.id, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label={S.searchPlaceholder}
          placeholder={S.searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-sm">
            <Switch
              checked={includeArchived}
              onCheckedChange={setIncludeArchived}
              label={S.showArchived}
            />
            {S.showArchived}
          </span>
          {canManage && (
            <Button type="button" size="sm" data-testid="product-new" onClick={openNew}>
              {S.newProduct}
            </Button>
          )}
        </div>
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <SettingsCard>
        <SettingsCardHeader title={S.tableLabel} />
        {visible.length === 0 ? (
          <SettingsCardBody>
            <p className="text-sm text-muted-foreground">
              {products.length === 0 ? S.empty : S.emptySearch}
            </p>
          </SettingsCardBody>
        ) : (
          <table className="w-full text-sm" data-testid="products-table">
            <thead className={SETTINGS_TABLE_HEAD}>
              <tr>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.name}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.code}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.price}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.taxPercent}</th>
                <th className={SETTINGS_TABLE_HEADER_CELL}>{S.status}</th>
                {canManage && <th className={SETTINGS_TABLE_HEADER_CELL} aria-label={S.actions} />}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  data-testid="product-row"
                  data-product-id={row.id}
                  className={SETTINGS_TABLE_ROW}
                >
                  <td className={SETTINGS_TABLE_CELL}>{row.name}</td>
                  <td className={SETTINGS_TABLE_CELL}>{row.code ?? ""}</td>
                  <td className={`${SETTINGS_TABLE_CELL} tabular-nums`}>
                    {formatMoney(Math.round(Number(row.price) * 10 ** currencyMinorDigits(row.currency)), row.currency, { decimals: 2 })}
                  </td>
                  <td className={`${SETTINGS_TABLE_CELL} tabular-nums`}>{row.taxPercent}%</td>
                  <td className={SETTINGS_TABLE_CELL}>
                    <Badge variant={row.active ? "success" : "secondary"}>
                      {row.active ? S.statusActive : S.statusArchived}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className={`${SETTINGS_TABLE_CELL} text-right`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`${S.actions} ${row.name}`}
                            disabled={pending}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>
                            {S.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => void toggleActive(row)}>
                            {row.active ? S.archive : S.restore}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => setPendingDelete(row)}
                          >
                            {S.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsCard>

      <ProductDialog
        key={dialogKey}
        open={dialogOpen}
        product={editing}
        baseCurrency={baseCurrency}
        codes={codes}
        onOpenChange={setDialogOpen}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={S.deleteTitle}
        description={S.deleteDescription}
        confirmLabel={S.deleteConfirm}
        destructive
        pending={pending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
