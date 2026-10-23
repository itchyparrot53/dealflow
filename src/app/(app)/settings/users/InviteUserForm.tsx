"use client";

import { UserPlus } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { ERROR_IDS } from "@/constants/errorIds";
import { inviteUserAction } from "@/features/identity/actions/invite";
import { isValidEmail } from "@/lib/isValidEmail";
import { readCsrfToken } from "@/utils/csrfCookie";

const T = {
  emailMissing: "Enter an email address.",
  emailInvalid: "Enter a valid email address.",
  nameMissing: "Enter a name.",
  emailLabel: "Email",
  emailPlaceholder: "person@example.com",
  nameLabel: "Name",
  namePlaceholder: "Full name",
  admin: "Admin",
  invite: "Invite",
  inviting: "Inviting...",
  inviteLinkLabel: "Invite link",
  copy: "Copy link",
  copied: "Copied",
} as const;

const MESSAGES: Record<string, string> = {
  [ERROR_IDS.AUTH_EMAIL_TAKEN]: "That email is already registered.",
  [ERROR_IDS.PERM_DENIED]: "You do not have permission to invite users.",
  [ERROR_IDS.AUTH_INVITE_INPUT_INVALID]: "Enter a valid email and name.",
};

function inviteErrorMessage(id: string): string {
  return MESSAGES[id] ?? "Something went wrong. Please try again.";
}

interface FieldErrors {
  email: string | null;
  name: string | null;
}

const NO_FIELD_ERRORS: FieldErrors = { email: null, name: null };

function validate(email: string, name: string): FieldErrors {
  return {
    email: email.length === 0 ? T.emailMissing : isValidEmail(email) ? null : T.emailInvalid,
    name: name.length === 0 ? T.nameMissing : null,
  };
}

interface Props {
  onInvited: () => void;
}

export function InviteUserForm({ onInvited }: Props): React.ReactElement {
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Per-field validation, shown inline instead of the browser's own validation bubble.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  // Set on a successful invite so the admin sees whether mail went out and can copy the link.
  const [invited, setInvited] = useState<{
    name: string;
    email: string;
    inviteUrl: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? "";
    const name = nameRef.current?.value.trim() ?? "";
    const invalid = validate(email, name);
    setFieldErrors(invalid);
    if (invalid.email !== null || invalid.name !== null) return;
    setError(null);
    const csrf = readCsrfToken();
    startTransition(async () => {
      const result = await inviteUserAction(csrf, { email, name, isAdmin });
      if (!result.ok) {
        setError(inviteErrorMessage(result.error.id));
        return;
      }
      if (emailRef.current !== null) emailRef.current.value = "";
      if (nameRef.current !== null) nameRef.current.value = "";
      setIsAdmin(false);
      setCopied(false);
      setInvited({
        name,
        email,
        inviteUrl: result.inviteUrl,
        emailSent: result.emailSent,
      });
      onInvited();
    });
  }

  async function copyLink(url: string): Promise<void> {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-muted-foreground">
          <UserPlus className="size-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Invite a user</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add a teammate and choose whether they can manage company settings.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <FormGrid columns={2}>
          <FormField
            label={T.emailLabel}
            htmlFor="invite-email"
            error={
              fieldErrors.email !== null ? (
                <span id="invite-email-error">{fieldErrors.email}</span>
              ) : undefined
            }
          >
            <Input
              ref={emailRef}
              id="invite-email"
              type="email"
              required
              aria-invalid={fieldErrors.email !== null}
              aria-describedby={fieldErrors.email !== null ? "invite-email-error" : undefined}
              placeholder={T.emailPlaceholder}
              className="w-full px-3"
              disabled={isPending}
            />
          </FormField>
          <FormField
            label={T.nameLabel}
            htmlFor="invite-name"
            error={
              fieldErrors.name !== null ? (
                <span id="invite-name-error">{fieldErrors.name}</span>
              ) : undefined
            }
          >
            <Input
              ref={nameRef}
              id="invite-name"
              type="text"
              required
              maxLength={120}
              aria-invalid={fieldErrors.name !== null}
              aria-describedby={fieldErrors.name !== null ? "invite-name-error" : undefined}
              placeholder={T.namePlaceholder}
              className="w-full px-3"
              disabled={isPending}
            />
          </FormField>
        </FormGrid>
        <span className="flex items-center gap-2 text-sm">
          <Switch checked={isAdmin} onCheckedChange={setIsAdmin} label={T.admin} />
          {T.admin}
        </span>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {invited !== null && (
          <div
            role="status"
            data-testid="invite-result"
            className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3"
          >
            <p className="text-sm text-muted-foreground">
              {invited.emailSent
                ? `Invite sent to ${invited.email}.`
                : `Email is not set up, so no invite was sent. Share this link with ${invited.name}:`}
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                aria-label={T.inviteLinkLabel}
                data-testid="invite-link"
                value={invited.inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void copyLink(invited.inviteUrl)}
              >
                {copied ? T.copied : T.copy}
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end border-t bg-muted/20 px-5 py-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? T.inviting : T.invite}
        </Button>
      </div>
    </form>
  );
}
