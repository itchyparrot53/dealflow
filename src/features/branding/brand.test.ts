import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STRINGS } from "@/constants/strings";
import { sampleVariables } from "@/features/email-design/registry";
import { renderDefaultTemplate } from "@/features/email-design/sendSystemEmail";
import { DEALFLOW_DESIGN } from "@/features/email-design/tokens";
import { renderNotificationEmail } from "@/features/notifications/email/render";
import type { NotificationRow } from "@/types/notification";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// Every file whose user-visible copy must say Dealflow. Comments may explain the upstream history,
// and the identifiers below keep the name by design (section 3 of PLAN-PART1.md): cookie and
// storage keys, event names, the release repository, the invalid base URL, the docs host and the
// MinIO bucket default.
const BRAND_FILES = [
  "src/constants/strings.ts",
  "src/constants/settingsStrings.ts",
  "src/constants/enrichmentStrings.ts",
  "src/app/(app)/settings/email-sync/strings.ts",
  "src/app/oauth/authorize/consent.tsx",
  "src/features/notifications/email/render.ts",
  "src/features/release/ui/VersionBanner.tsx",
  "src/features/leads/inbox/SourceOriginInfo.tsx",
  "src/features/deal-workspace/composer/VideoCallField.tsx",
  "src/app/layout.tsx",
];

const ALLOWED_IDENTIFIERS = [
  "wd_",
  "warpdrive:open-search",
  "warpdrive.dismissed_version",
  "warpdrive.rateLimiters",
  "warpdrive.jobs.boss",
  "warpdrive.invalid",
  "warpdrive-version-check",
  "sneg55/warpdrive",
  "docs.warpdrivecrm.com",
  "MINIO_BUCKET",
];

function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

const MENTION: NotificationRow = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  type: "mention",
  entityType: "deal",
  entityId: "33333333-3333-3333-3333-333333333333",
  actorId: null,
  payload: {},
  readAt: null,
  createdAt: "2026-10-19T10:00:00.000Z",
};

describe("Dealflow branding", () => {
  it("names the product Dealflow", () => {
    expect(STRINGS.app.name).toBe("Dealflow");
  });

  it("brands the mention notification email", () => {
    const copy = renderNotificationEmail(MENTION, "Alex");
    const mail = renderDefaultTemplate(
      "notification",
      sampleVariables("notification"),
      DEALFLOW_DESIGN,
    );
    expect(copy.subject).toBe("Somebody mentioned you in Dealflow");
    expect(mail.html).toContain("Dealflow");
    expect(mail.html).not.toContain("Warpdrive");
    expect(copy.subject).not.toContain("Warpdrive");
  });

  it.each(BRAND_FILES)("%s keeps the old name only in comments or internal identifiers", (file) => {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    for (const line of text.split("\n")) {
      if (!/warpdrive/i.test(line)) continue;
      const allowed = isComment(line) || ALLOWED_IDENTIFIERS.some((id) => line.includes(id));
      expect(allowed, `${file}: ${line.trim()}`).toBe(true);
    }
  });
});
