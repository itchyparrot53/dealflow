"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { BOOKING_STRINGS } from "@/constants/formsBookingStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { updateBookingPageAction } from "../actions";
import type { Availability } from "../slots";
import { AvailabilityEditor } from "./AvailabilityEditor";

const S = BOOKING_STRINGS;

export interface BookingPageEditorView {
  id: string;
  publicId: string;
  hostId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  daysAhead: number;
  timezone: string;
  availability: Availability;
  activityTypeId: string;
  location: string | null;
  active: boolean;
}

function timezoneOptions(): { value: string; label: string }[] {
  const supported: string[] = [];
  // Intl.supportedValuesOf omits "UTC" even though it is the default the server writes, so the
  // canonical alias is added first and the list de-duplicated.
  supported.push("UTC");
  try {
    // Intl.supportedValuesOf is available in every browser this app supports; the fallback keeps
    // the picker usable if an older engine lacks it.
    const zones: string[] = Intl.supportedValuesOf("timeZone");
    supported.push(...zones);
  } catch {
    supported.push("Europe/London", "Europe/Berlin", "America/New_York", "Asia/Kolkata");
  }
  return [...new Set(supported)].map((zone) => ({ value: zone, label: zone }));
}

const TIMEZONES = timezoneOptions();

const MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120].map((value) => ({
  value: String(value),
  label: `${value} ${S.editor.minutes}`,
}));
const BUFFER_OPTIONS = [0, 5, 10, 15, 30].map((value) => ({
  value: String(value),
  label: `${value} ${S.editor.minutes}`,
}));
const NOTICE_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48, 72, 168].map((value) => ({
  value: String(value),
  label: `${value} ${S.editor.hours}`,
}));
const DAYS_OPTIONS = [7, 14, 30, 60, 90].map((value) => ({
  value: String(value),
  label: `${value} ${S.editor.days}`,
}));

export function BookingPageEditor({
  page,
  lookups,
  isAdmin,
  baseUrl,
}: {
  page: BookingPageEditorView;
  lookups: { activityTypes: { id: string; name: string }[]; users: { id: string; name: string }[] };
  isAdmin: boolean;
  baseUrl: string;
}): React.ReactNode {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description ?? "");
  const [duration, setDuration] = useState(String(page.durationMinutes));
  const [buffer, setBuffer] = useState(String(page.bufferMinutes));
  const [notice, setNotice] = useState(String(page.minNoticeHours));
  const [daysAhead, setDaysAhead] = useState(String(page.daysAhead));
  const [timezone, setTimezone] = useState(page.timezone);
  const [activityTypeId, setActivityTypeId] = useState(page.activityTypeId);
  const [hostId, setHostId] = useState(page.hostId);
  const [location, setLocation] = useState(page.location ?? "");
  const [active, setActive] = useState(page.active);
  const [availability, setAvailability] = useState<Availability>(page.availability);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicLink = `${baseUrl}/book/${page.publicId}`;

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateBookingPageAction(
      page.id,
      {
        title,
        description: description.trim() === "" ? null : description,
        durationMinutes: Number(duration),
        bufferMinutes: Number(buffer),
        minNoticeHours: Number(notice),
        daysAhead: Number(daysAhead),
        timezone,
        activityTypeId,
        location: location.trim() === "" ? null : location,
        active,
        availability,
        ...(isAdmin ? { hostId } : {}),
      },
      readCsrfToken(),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function copyLink(): Promise<void> {
    await navigator.clipboard.writeText(publicLink);
    setCopied(true);
  }

  return (
    <div className="space-y-5" data-testid="booking-editor">
      <FormGrid columns={2}>
        <FormField label={S.editor.title} htmlFor="booking-title">
          <Input
            id="booking-title"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
        <FormField label={S.editor.activityType}>
          <Select
            value={activityTypeId}
            onChange={setActivityTypeId}
            options={lookups.activityTypes.map((type) => ({ value: type.id, label: type.name }))}
            ariaLabel={S.editor.activityType}
          />
        </FormField>
        <div data-span="full">
          <FormField label={S.editor.description} htmlFor="booking-description">
            <Textarea
              id="booking-description"
              value={description}
              rows={2}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
        </div>
        <FormField label={S.editor.duration}>
          <Select
            value={duration}
            onChange={setDuration}
            options={MINUTE_OPTIONS}
            ariaLabel={S.editor.duration}
          />
        </FormField>
        <FormField label={S.editor.buffer}>
          <Select
            value={buffer}
            onChange={setBuffer}
            options={BUFFER_OPTIONS}
            ariaLabel={S.editor.buffer}
          />
        </FormField>
        <FormField label={S.editor.notice}>
          <Select
            value={notice}
            onChange={setNotice}
            options={NOTICE_OPTIONS}
            ariaLabel={S.editor.notice}
            testId="booking-notice-select"
          />
        </FormField>
        <FormField label={S.editor.daysAhead}>
          <Select
            value={daysAhead}
            onChange={setDaysAhead}
            options={DAYS_OPTIONS}
            ariaLabel={S.editor.daysAhead}
          />
        </FormField>
        <FormField label={S.editor.timezone}>
          <Combobox
            value={timezone}
            onChange={setTimezone}
            options={TIMEZONES}
            ariaLabel={S.editor.timezone}
          />
        </FormField>
        <FormField label={S.editor.location} htmlFor="booking-location">
          <Input
            id="booking-location"
            value={location}
            maxLength={300}
            onChange={(event) => setLocation(event.target.value)}
          />
        </FormField>
        {isAdmin ? (
          <FormField label={S.editor.host}>
            <Select
              value={hostId}
              onChange={setHostId}
              options={lookups.users.map((user) => ({ value: user.id, label: user.name }))}
              ariaLabel={S.editor.host}
            />
          </FormField>
        ) : null}
        <FormField label={S.table.active}>
          <Switch checked={active} onCheckedChange={setActive} label={S.table.active} />
        </FormField>
      </FormGrid>

      <AvailabilityEditor availability={availability} onChange={setAvailability} />

      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={publicLink}
          aria-label={S.editor.publicLink}
          data-testid="booking-public-link"
        />
        <Button type="button" variant="outline" onClick={() => void copyLink()}>
          {copied ? S.editor.copied : S.editor.copy}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          data-testid="booking-save"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? S.editor.saving : S.editor.save}
        </Button>
        {saved ? <span className="text-sm text-muted-foreground">{S.editor.saved}</span> : null}
        {error === null ? null : <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
