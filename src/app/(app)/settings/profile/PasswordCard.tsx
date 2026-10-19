"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ERROR_IDS } from "@/constants/errorIds";
import { changePasswordAction } from "@/features/auth/passwordActions";
import { readCsrfToken } from "@/utils/csrfCookie";

const T = {
  heading: "Password",
  description: "Sign in with your email and this password. Changing it signs out other sessions.",
  current: "Current password",
  newPassword: "New password",
  confirm: "Confirm new password",
  save: "Save password",
  saving: "Saving...",
  saved: "Password saved. Other sessions were signed out.",
  mismatch: "The passwords don't match.",
  generic: "Could not save the password. Try again.",
} as const;

const MESSAGES: Record<string, string> = {
  [ERROR_IDS.AUTH_PASSWORD_WEAK]: "Use 12 to 128 characters.",
  [ERROR_IDS.AUTH_PASSWORD_MISMATCH]: "That current password is not right.",
  [ERROR_IDS.AUTH_INPUT_INVALID]: "Use 12 to 128 characters.",
};

interface Props {
  hasPassword: boolean;
}

// Sets the first password or changes an existing one. Only the success state is shared with the
// page (the other card fields are local to the form).
export function PasswordCard({ hasPassword }: Props): React.ReactNode {
  const id = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaved(false);
    setError(null);
    if (newPassword !== confirm) {
      setError(T.mismatch);
      return;
    }
    setSaving(true);
    try {
      const result = await changePasswordAction(
        { currentPassword: hasPassword ? currentPassword : undefined, newPassword },
        readCsrfToken(),
      );
      if (!result.ok) {
        setError(MESSAGES[result.error.id] ?? T.generic);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-testid="password-card"
      className="overflow-hidden rounded-lg border bg-card shadow-sm"
    >
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">{T.heading}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{T.description}</p>
      </div>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-5">
        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-current`}>{T.current}</Label>
            <Input
              id={`${id}-current`}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={saving}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-new`}>{T.newPassword}</Label>
          <Input
            id={`${id}-new`}
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-confirm`}>{T.confirm}</Label>
          <Input
            id={`${id}-confirm`}
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            disabled={saving}
          />
        </div>
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p data-testid="password-saved" role="status" className="text-sm text-muted-foreground">
            {T.saved}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? T.saving : T.save}
          </Button>
        </div>
      </form>
    </section>
  );
}
