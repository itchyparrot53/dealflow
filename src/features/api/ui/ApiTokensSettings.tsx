"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PROJECTS_API_STRINGS, projectsErrorMessage } from "@/constants/projectsApiStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { revokeTokenAction } from "../actions";
import type { TokenView } from "../tokens";
import { NewTokenDialog } from "./NewTokenDialog";

const S = PROJECTS_API_STRINGS.api;

function day(iso: string | null): string {
  return iso === null ? S.never : iso.slice(0, 10);
}

export function ApiTokensSettings({ tokens }: { tokens: TokenView[] }): React.ReactNode {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function revoke(): Promise<void> {
    if (revokeId === null) return;
    setPending(true);
    const response = await revokeTokenAction(revokeId, readCsrfToken());
    setPending(false);
    setRevokeId(null);
    if (!response.ok) {
      setErrorId(response.error.id);
      return;
    }
    router.refresh();
  }

  const active = tokens.filter((token) => token.revokedAt === null);

  return (
    <div className="space-y-3">
      {errorId !== null && (
        <p role="alert" className="text-sm text-destructive">
          {projectsErrorMessage(errorId)}
        </p>
      )}
      <div>
        <Button type="button" data-testid="api-token-new" onClick={() => setNewOpen(true)}>
          {S.newToken}
        </Button>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{S.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table data-testid="api-tokens-table" className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{S.columns.name}</th>
                <th className="px-3 py-2 font-medium">{S.columns.prefix}</th>
                <th className="px-3 py-2 font-medium">{S.columns.scope}</th>
                <th className="px-3 py-2 font-medium">{S.columns.user}</th>
                <th className="px-3 py-2 font-medium">{S.columns.created}</th>
                <th className="px-3 py-2 font-medium">{S.columns.lastUsed}</th>
                <th className="px-3 py-2 font-medium">{S.columns.expires}</th>
                <th className="px-3 py-2 font-medium">{S.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} data-testid="api-token-row" className="border-t">
                  <td className="px-3 py-2">{token.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{token.prefix}...</td>
                  <td className="px-3 py-2">
                    <Badge variant={token.scope === "write" ? "default" : "secondary"}>
                      {token.scope === "write" ? S.scopeWrite : S.scopeRead}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{token.userName}</td>
                  <td className="px-3 py-2">{day(token.createdAt)}</td>
                  <td className="px-3 py-2">
                    {token.lastUsedAt === null ? S.never : day(token.lastUsedAt)}
                  </td>
                  <td className="px-3 py-2">{day(token.expiresAt)}</td>
                  <td className="px-3 py-2">
                    {token.revokedAt === null ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="api-token-revoke"
                        onClick={() => setRevokeId(token.id)}
                      >
                        {S.revoke}
                      </Button>
                    ) : (
                      <Badge variant="destructive">{S.revoked}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {active.length} {S.tokensTab.toLowerCase()}
      </p>

      <NewTokenDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => router.refresh()} />
      <ConfirmDialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeId(null);
        }}
        title={S.confirmRevoke}
        description={S.confirmRevokeBody}
        confirmLabel={S.revoke}
        destructive
        pending={pending}
        onConfirm={() => void revoke()}
      />
    </div>
  );
}
