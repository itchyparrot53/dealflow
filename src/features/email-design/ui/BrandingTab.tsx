"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { EMAIL_DESIGN_STRINGS } from "@/constants/emailDesignStrings";
import { ERROR_IDS } from "@/constants/errorIds";
import type { EmailDesignView } from "@/features/email-design/design";
import type { DesignInput } from "@/features/email-design/schemas";
import { useToastStore } from "@/features/feedback/toastStore";
import { trpc } from "@/lib/trpc-client";
import { readCsrfToken } from "@/utils/csrfCookie";
import {
  removeEmailLogoAction,
  saveEmailDesignAction,
  sendEmailDesignTestAction,
  uploadEmailLogoAction,
} from "../actions";
import { EmailPreview } from "./EmailPreview";

const S = EMAIL_DESIGN_STRINGS.branding;

function toDraft(design: EmailDesignView): DesignInput {
  return {
    displayName: design.displayName === "" ? null : design.displayName,
    accentColor: design.accentColor,
    showAddress: design.showAddress,
    footerText: design.footerText,
    showPoweredBy: design.showPoweredBy,
    newEmailLayout: design.newEmailLayout,
    replyLayout: design.replyLayout,
    footerOnReplies: design.footerOnReplies,
  };
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function BrandingTab({ initial }: { initial: EmailDesignView }): React.ReactNode {
  const router = useRouter();
  const toast = useToastStore((state) => state.push);
  const [design, setDesign] = useState(initial);
  const [draft, setDraft] = useState<DesignInput>(toDraft(initial));
  const [pending, setPending] = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(draft, 300);
  const preview = trpc.emailDesign.previewDesign.useQuery(
    { ...debounced, logoUrl: design.logo?.url },
    { refetchOnWindowFocus: false },
  );

  function set<K extends keyof DesignInput>(key: K, value: DesignInput[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function failure(id: string): void {
    const message =
      id === ERROR_IDS.EMAIL_DESIGN_ACCENT_CONTRAST
        ? S.contrastFailed
        : id === ERROR_IDS.EMAIL_DESIGN_LOGO_INVALID ||
            id === ERROR_IDS.EMAIL_DESIGN_LOGO_TOO_LARGE ||
            id === ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID
          ? S.uploadFailed
          : S.saveFailed;
    toast({ message, tone: "error" });
  }

  async function save(): Promise<void> {
    setPending(true);
    const result = await saveEmailDesignAction(draft, readCsrfToken());
    setPending(false);
    if (!result.ok) {
      failure(result.error.id);
      return;
    }
    setDesign(result.value);
    setDraft(toDraft(result.value));
    toast({ message: S.saved });
    router.refresh();
  }

  async function sendTest(): Promise<void> {
    setTestPending(true);
    const result = await sendEmailDesignTestAction(readCsrfToken());
    setTestPending(false);
    if (!result.ok) {
      failure(result.error.id);
      return;
    }
    toast({ message: S.testSent });
  }

  async function upload(file: File): Promise<void> {
    setUploading(true);
    const data = new FormData();
    data.set("file", file);
    const result = await uploadEmailLogoAction(data, readCsrfToken());
    setUploading(false);
    if (!result.ok) {
      failure(result.error.id);
      return;
    }
    setDesign(result.value);
    toast({ message: S.logoUploaded });
    router.refresh();
  }

  async function removeLogo(): Promise<void> {
    const result = await removeEmailLogoAction(readCsrfToken());
    if (!result.ok) {
      failure(result.error.id);
      return;
    }
    setDesign(result.value);
    toast({ message: S.logoRemoved });
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
      <div className="space-y-5">
        <FormField label={S.logo} hint={S.logoHint}>
          <div className="flex flex-wrap items-center gap-3">
            {design.logo === null ? (
              <span className="flex h-10 items-center rounded-md border border-dashed px-3 text-meta text-muted-foreground">
                {design.displayName}
              </span>
            ) : (
              <img
                src={design.logo.url}
                alt={design.displayName}
                className="h-10 w-auto max-w-[200px] rounded border bg-white object-contain p-1"
              />
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              aria-label={S.uploadLogo}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) void upload(file);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {S.uploadLogo}
            </Button>
            {design.logo !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void removeLogo()}>
                {S.removeLogo}
              </Button>
            )}
          </div>
        </FormField>

        <FormField label={S.displayName} hint={S.displayNameHint}>
          <Input
            value={draft.displayName ?? ""}
            onChange={(event) =>
              set("displayName", event.target.value === "" ? null : event.target.value)
            }
            placeholder={design.displayName}
            maxLength={200}
          />
        </FormField>

        <FormField label={S.accent} hint={S.accentHint}>
          <div className="flex items-center gap-2">
            <ColorPicker
              value={draft.accentColor}
              onChange={(value) => set("accentColor", value)}
              ariaLabel={S.accent}
            />
            <Input
              value={draft.accentColor}
              onChange={(event) => set("accentColor", event.target.value)}
              aria-label={`${S.accent} hex value`}
              maxLength={7}
              className="h-8 w-28 font-mono"
            />
          </div>
        </FormField>

        <FormField
          label={S.showAddress}
          hint={
            <>
              {S.addressHint}{" "}
              <Link href="/settings/documents" className="underline">
                {S.editAddress}
              </Link>
              {design.addressLines.length > 0
                ? ` (${design.addressLines.join(", ")})`
                : ` (${S.noAddress})`}
            </>
          }
        >
          <Switch
            checked={draft.showAddress}
            onCheckedChange={(checked) => set("showAddress", checked)}
            label={S.showAddress}
          />
        </FormField>

        <FormField label={S.footerText} hint={S.footerTextHint}>
          <Textarea
            value={draft.footerText ?? ""}
            onChange={(event) =>
              set("footerText", event.target.value === "" ? null : event.target.value)
            }
            rows={3}
            maxLength={500}
          />
        </FormField>

        <FormField label={S.showPoweredBy}>
          <Switch
            checked={draft.showPoweredBy}
            onCheckedChange={(checked) => set("showPoweredBy", checked)}
            label={S.showPoweredBy}
          />
        </FormField>

        <FormGrid columns={2}>
          <FormField label={S.newEmails} hint={S.newEmailsHint}>
            <Select
              value={draft.newEmailLayout}
              onChange={(value) => set("newEmailLayout", value === "plain" ? "plain" : "branded")}
              options={[
                { value: "branded", label: S.layoutBranded },
                { value: "plain", label: S.layoutPlain },
              ]}
              ariaLabel={S.newEmails}
            />
          </FormField>
          <FormField label={S.replies} hint={S.repliesHint}>
            <Select
              value={draft.replyLayout}
              onChange={(value) =>
                set(
                  "replyLayout",
                  value === "branded" ? "branded" : value === "plain" ? "plain" : "minimal",
                )
              }
              options={[
                { value: "minimal", label: S.layoutMinimal },
                { value: "branded", label: S.layoutBranded },
                { value: "plain", label: S.layoutPlain },
              ]}
              ariaLabel={S.replies}
            />
          </FormField>
        </FormGrid>

        <FormField label={S.footerOnReplies}>
          <Switch
            checked={draft.footerOnReplies}
            onCheckedChange={(checked) => set("footerOnReplies", checked)}
            label={S.footerOnReplies}
          />
        </FormField>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="button" loading={pending} onClick={() => void save()}>
            {S.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={testPending}
            onClick={() => void sendTest()}
          >
            {S.sendTest}
          </Button>
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:self-start">
        <h2 className="mb-2 text-sm font-medium text-foreground">{S.preview}</h2>
        {preview.data === undefined ? (
          <div className="h-[660px] animate-pulse rounded-lg border bg-canvas-subtle" />
        ) : (
          <EmailPreview html={preview.data.html} />
        )}
      </div>
    </div>
  );
}
