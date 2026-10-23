"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { createTokenAction } from "../actions";

const S = PROJECTS_API_STRINGS.api;

const EXPIRY_OPTIONS = [
  { value: "never", label: S.expiresNever },
  { value: "7", label: S.expires7 },
  { value: "30", label: S.expires30 },
  { value: "90", label: S.expires90 },
  { value: "365", label: S.expires365 },
];

export function NewTokenDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): React.ReactNode {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("read");
  const [expiry, setExpiry] = useState("never");
  const [token, setToken] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  function close(next: boolean): void {
    if (!next) {
      setName("");
      setScope("read");
      setExpiry("never");
      setToken(null);
      setErrorId(null);
      setCopied(false);
    }
    onOpenChange(next);
  }

  async function create(): Promise<void> {
    if (name.trim() === "") return;
    setPending(true);
    setErrorId(null);
    const response = await createTokenAction(
      {
        name: name.trim(),
        scope,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      },
      readCsrfToken(),
    );
    setPending(false);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    setToken(response.value.token);
    onCreated();
  }

  async function copy(): Promise<void> {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      // The token stays visible so it can be copied by hand.
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{S.newToken}</DialogTitle>
          <DialogDescription>{S.newTokenDescription}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {token === null ? (
            <div className="space-y-3">
              {errorId !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {projectsErrorMessage(errorId)}
                </p>
              )}
              <FormField label={S.tokenName} htmlFor="token-name">
                <Input
                  id="token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={S.tokenNamePlaceholder}
                  aria-label={S.tokenName}
                />
              </FormField>
              <FormGrid columns={2}>
                <FormField label={S.scope}>
                  <Select
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: "read", label: S.scopeRead },
                      { value: "write", label: S.scopeWrite },
                    ]}
                    ariaLabel={S.scope}
                  />
                </FormField>
                <FormField label={S.expires}>
                  <Select
                    value={expiry}
                    onChange={setExpiry}
                    options={EXPIRY_OPTIONS}
                    ariaLabel={S.expires}
                  />
                </FormField>
              </FormGrid>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{S.tokenOnce}</p>
              <div className="flex items-center gap-2">
                <code
                  data-testid="api-token-secret"
                  className="min-w-0 flex-1 break-all rounded-md border bg-muted px-2 py-1 text-xs"
                >
                  {token}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
                  {copied ? S.copied : S.copy}
                </Button>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {token === null ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => close(false)}>
                {S.close}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || name.trim() === ""}
                onClick={() => void create()}
              >
                {pending ? S.creating : S.create}
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => close(false)}>
              {S.close}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
