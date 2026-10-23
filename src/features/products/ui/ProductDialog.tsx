"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ERROR_IDS } from "@/constants/errorIds";
import { PRODUCTS_STRINGS } from "@/constants/salesStrings";
import { currencyOptions } from "@/features/currency/ui/currencyOptions";
import { createProductAction, updateProductAction } from "@/features/products/actions";
import { readCsrfToken } from "@/utils/csrfCookie";

const S = PRODUCTS_STRINGS;

export interface ProductFormValues {
  id: string;
  name: string;
  code: string | null;
  unit: string | null;
  price: string;
  currency: string;
  taxPercent: string;
}

interface FormState {
  name: string;
  code: string;
  unit: string;
  price: string;
  currency: string;
  taxPercent: string;
}

interface Props {
  open: boolean;
  product: ProductFormValues | null;
  baseCurrency: string;
  codes: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function initialState(product: ProductFormValues | null, baseCurrency: string): FormState {
  if (product === null) {
    return {
      name: "",
      code: "",
      unit: "",
      price: "0.00",
      currency: baseCurrency,
      taxPercent: "0",
    };
  }
  return {
    name: product.name,
    code: product.code ?? "",
    unit: product.unit ?? "",
    price: product.price,
    currency: product.currency,
    taxPercent: product.taxPercent,
  };
}

function errorText(id: string): string {
  switch (id) {
    case ERROR_IDS.PRODUCT_IN_USE:
      return S.inUse;
    case ERROR_IDS.PRODUCT_CODE_TAKEN:
      return S.codeTaken;
    case ERROR_IDS.PRODUCT_NOT_FOUND:
      return S.notFound;
    case ERROR_IDS.CURRENCY_UNKNOWN:
      return S.unknownCode;
    case ERROR_IDS.PRODUCT_INPUT_INVALID:
      return S.invalid;
    case ERROR_IDS.PERM_DENIED:
      return S.adminOnly;
    case ERROR_IDS.AUTH_SESSION_DEAD:
    case "E_AUTH_CSRF":
      return S.sessionExpired;
    default:
      return S.saveFailed;
  }
}

export function ProductDialog({
  open,
  product,
  baseCurrency,
  codes,
  onOpenChange,
  onSaved,
}: Props): React.ReactNode {
  const [form, setForm] = useState<FormState>(() => initialState(product, baseCurrency));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(): Promise<void> {
    setPending(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() === "" ? null : form.code.trim(),
      unit: form.unit.trim() === "" ? null : form.unit.trim(),
      price: form.price.trim(),
      currency: form.currency,
      taxPercent: form.taxPercent.trim(),
    };
    const result =
      product === null
        ? await createProductAction(payload, readCsrfToken())
        : await updateProductAction({ ...payload, id: product.id }, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      setError(errorText(result.error.id));
      return;
    }
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="product-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product === null ? S.newProduct : S.editProduct}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2" htmlFor="product-name">
              <span className="mb-1.5 block text-sm font-medium">{S.name}</span>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                autoFocus
              />
            </label>
            <label className="block" htmlFor="product-code">
              <span className="mb-1.5 block text-sm font-medium">{S.code}</span>
              <Input
                id="product-code"
                value={form.code}
                onChange={(event) => update("code", event.target.value)}
              />
            </label>
            <label className="block" htmlFor="product-unit">
              <span className="mb-1.5 block text-sm font-medium">{S.unit}</span>
              <Input
                id="product-unit"
                value={form.unit}
                onChange={(event) => update("unit", event.target.value)}
              />
            </label>
            <label className="block" htmlFor="product-price">
              <span className="mb-1.5 block text-sm font-medium">{S.price}</span>
              <Input
                id="product-price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => update("price", event.target.value)}
              />
            </label>
            <div className="block">
              <span className="mb-1.5 block text-sm font-medium">{S.currency}</span>
              <Select
                value={form.currency}
                onChange={(value) => update("currency", value)}
                options={currencyOptions(codes)}
                ariaLabel={S.currency}
              />
            </div>
            <label className="block" htmlFor="product-tax">
              <span className="mb-1.5 block text-sm font-medium">{S.taxPercent}</span>
              <Input
                id="product-tax"
                inputMode="decimal"
                value={form.taxPercent}
                onChange={(event) => update("taxPercent", event.target.value)}
              />
            </label>
          </div>
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {S.cancel}
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
            {pending ? S.saving : S.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
