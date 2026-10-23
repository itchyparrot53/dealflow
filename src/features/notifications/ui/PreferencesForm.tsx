"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/Switch";
import type { NotificationType } from "@/constants/notificationTypes";
import { NOTIFICATION_TYPES } from "@/constants/notificationTypes";
import { STRINGS } from "@/constants/strings";

type Prefs = Record<NotificationType, { inApp: boolean; email: boolean; push: boolean }>;

type ToggleProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  testId?: string;
  dataType?: string;
};

function Toggle({ label, checked, onChange, testId, dataType }: ToggleProps) {
  const id = useId();
  return (
    <span
      data-testid={testId}
      data-type={dataType}
      className="flex items-center gap-2 text-sm select-none"
    >
      <label htmlFor={id} className="cursor-pointer text-muted-foreground">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} label={label} />
    </span>
  );
}

export function PreferencesForm({
  prefs,
  onChange,
  showPush = true,
}: {
  prefs: Prefs;
  onChange: (type: NotificationType, next: Prefs[NotificationType]) => void;
  // 6.4: the Push column disappears with NEXT_PUBLIC_PWA_UI off; In-app and Email stay.
  showPush?: boolean;
}) {
  const { columnInApp, columnEmail, columnPush, typeLabels } = STRINGS.notifications.preferences;

  return (
    <div className="divide-y">
      {NOTIFICATION_TYPES.map((type) => (
        <div key={type} data-testid="pref-row" className="flex items-center justify-between py-3">
          <span className="text-sm font-medium">{typeLabels[type]}</span>
          <div className="flex items-center gap-6">
            <Toggle
              label={columnInApp}
              checked={prefs[type].inApp}
              onChange={(next) => onChange(type, { ...prefs[type], inApp: next })}
            />
            <Toggle
              label={columnEmail}
              checked={prefs[type].email}
              onChange={(next) => onChange(type, { ...prefs[type], email: next })}
            />
            {showPush ? (
              <Toggle
                label={columnPush}
                checked={prefs[type].push}
                testId="push-pref"
                dataType={type}
                onChange={(next) => onChange(type, { ...prefs[type], push: next })}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
