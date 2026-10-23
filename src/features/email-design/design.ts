import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import { emailDesign, settings } from "@/db/schema";
import { getDocumentSettings } from "@/features/documents/settings";
import { recordAudit } from "@/features/identity/audit";
import type { PermSetUser } from "@/features/permissions/effective";
import { err, ok, type Result } from "@/types/result";
import { imageSize } from "./imageSize";
import { contrastRatio } from "./layout";
import type { EmailDesign, EmailLogo, NewEmailLayout, ReplyLayout } from "./tokens";

// The single company email design (PLAN-PART13 6.3). Reads merge the company name and the
// Documents address; writes are admin-only, validated and audited. Logo bytes never leave this
// module except through getEmailLogo, which the public route calls.

export const MAX_LOGO_BYTES = 256 * 1024;
export const MAX_LOGO_PX = 2000;

export interface EmailDesignView extends EmailDesign {
  updatedAt: string;
}

export interface SaveEmailDesignInput {
  displayName: string | null;
  accentColor: string;
  showAddress: boolean;
  footerText: string | null;
  showPoweredBy: boolean;
  newEmailLayout: NewEmailLayout;
  replyLayout: ReplyLayout;
  footerOnReplies: boolean;
}

interface DesignRow {
  displayName: string | null;
  accentColor: string;
  showAddress: boolean;
  footerText: string | null;
  showPoweredBy: boolean;
  newEmailLayout: string;
  replyLayout: string;
  footerOnReplies: boolean;
  logoMime: string | null;
  logoHash: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  updatedAt: Date;
}

const DESIGN_COLUMNS = {
  displayName: emailDesign.displayName,
  accentColor: emailDesign.accentColor,
  showAddress: emailDesign.showAddress,
  footerText: emailDesign.footerText,
  showPoweredBy: emailDesign.showPoweredBy,
  newEmailLayout: emailDesign.newEmailLayout,
  replyLayout: emailDesign.replyLayout,
  footerOnReplies: emailDesign.footerOnReplies,
  logoMime: emailDesign.logoMime,
  logoHash: emailDesign.logoHash,
  logoWidth: emailDesign.logoWidth,
  logoHeight: emailDesign.logoHeight,
  updatedAt: emailDesign.updatedAt,
};

async function readRow(db: Db, signal: AbortSignal): Promise<DesignRow> {
  signal.throwIfAborted();
  const [row] = await db.select(DESIGN_COLUMNS).from(emailDesign).where(eq(emailDesign.id, 1));
  if (row !== undefined) return row;
  // The migration seeds the singleton; a test database that predates it still gets a row.
  await db.insert(emailDesign).values({ id: 1 }).onConflictDoNothing();
  const [created] = await db.select(DESIGN_COLUMNS).from(emailDesign).where(eq(emailDesign.id, 1));
  if (created === undefined) {
    throw new AppError(ERROR_IDS.DB_INVARIANT, "email_design singleton missing after insert", {});
  }
  return created;
}

export function logoPublicPath(hash: string, mime: string): string {
  return `/email-assets/logo/${hash}.${mime === "image/jpeg" ? "jpg" : "png"}`;
}

export function assertAccentColor(
  accent: string,
): Result<{ accent: string; ratio: number }, AppError> {
  if (!/^#[0-9A-Fa-f]{6}$/.test(accent)) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_INPUT_INVALID, "accent colour must be a hex colour"),
    );
  }
  const ratio = contrastRatio(accent, "#FFFFFF");
  if (ratio < 4.5) {
    return err(
      new AppError(
        ERROR_IDS.EMAIL_DESIGN_ACCENT_CONTRAST,
        `Choose a darker colour so button text stays readable (${ratio.toFixed(2)}:1, needs 4.5:1).`,
        { ratio },
      ),
    );
  }
  return ok({ accent, ratio });
}

function admin(actor: PermSetUser | null): Result<PermSetUser, AppError> {
  if (actor === null || actor.type !== "admin") {
    return err(new AppError(ERROR_IDS.PERM_DENIED, "admin only"));
  }
  return ok(actor);
}

function toView(
  row: DesignRow,
  companyName: string | null,
  address: string | null,
): EmailDesignView {
  const logo: EmailLogo | null =
    row.logoHash !== null &&
    row.logoMime !== null &&
    row.logoWidth !== null &&
    row.logoHeight !== null
      ? {
          url: new URL(logoPublicPath(row.logoHash, row.logoMime), env.BASE_URL).toString(),
          width: row.logoWidth,
          height: row.logoHeight,
        }
      : null;
  return {
    displayName: row.displayName ?? companyName ?? "Dealflow",
    accentColor: row.accentColor,
    logo,
    showAddress: row.showAddress,
    addressLines:
      address === null
        ? []
        : address
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line !== ""),
    footerText: row.footerText,
    showPoweredBy: row.showPoweredBy,
    newEmailLayout: row.newEmailLayout === "plain" ? "plain" : "branded",
    replyLayout:
      row.replyLayout === "plain" ? "plain" : row.replyLayout === "branded" ? "branded" : "minimal",
    footerOnReplies: row.footerOnReplies,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function companyName(db: Db, signal: AbortSignal): Promise<string | null> {
  const [row] = await db.select({ companyName: settings.companyName }).from(settings);
  signal.throwIfAborted();
  return row?.companyName ?? null;
}

export async function getEmailDesign(db: Db, signal: AbortSignal): Promise<EmailDesignView> {
  const [row, name, documents] = await Promise.all([
    readRow(db, signal),
    companyName(db, signal),
    getDocumentSettings(db, signal),
  ]);
  return toView(row, name, documents.companyAddress);
}

export async function saveEmailDesign(
  db: Db,
  actor: PermSetUser | null,
  input: SaveEmailDesignInput,
  signal: AbortSignal,
): Promise<Result<EmailDesignView, AppError>> {
  const allowed = admin(actor);
  if (!allowed.ok) return allowed;
  const accent = assertAccentColor(input.accentColor);
  if (!accent.ok) return accent;

  const before = await getEmailDesign(db, signal);
  const [row] = await db
    .update(emailDesign)
    .set({
      displayName:
        input.displayName === null || input.displayName.trim() === ""
          ? null
          : input.displayName.trim(),
      accentColor: accent.value.accent,
      showAddress: input.showAddress,
      footerText:
        input.footerText === null || input.footerText.trim() === "" ? null : input.footerText,
      showPoweredBy: input.showPoweredBy,
      newEmailLayout: input.newEmailLayout,
      replyLayout: input.replyLayout,
      footerOnReplies: input.footerOnReplies,
      updatedBy: allowed.value.id,
      updatedAt: new Date(),
    })
    .where(eq(emailDesign.id, 1))
    .returning(DESIGN_COLUMNS);
  signal.throwIfAborted();
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INVARIANT, "email_design update returned no row"));
  }
  const after = await getEmailDesign(db, signal);
  await recordAudit(
    db,
    {
      actorId: allowed.value.id,
      targetType: "settings",
      targetId: null,
      action: "email_design.updated",
      before: {
        displayName: before.displayName,
        accentColor: before.accentColor,
        newEmailLayout: before.newEmailLayout,
        replyLayout: before.replyLayout,
        showAddress: before.showAddress,
        showPoweredBy: before.showPoweredBy,
      },
      after: {
        displayName: after.displayName,
        accentColor: after.accentColor,
        newEmailLayout: after.newEmailLayout,
        replyLayout: after.replyLayout,
        showAddress: after.showAddress,
        showPoweredBy: after.showPoweredBy,
      },
    },
    signal,
  );
  return ok(after);
}

export interface UploadFile {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export async function uploadEmailLogo(
  db: Db,
  actor: PermSetUser | null,
  file: UploadFile,
  signal: AbortSignal,
): Promise<Result<EmailDesignView, AppError>> {
  const allowed = admin(actor);
  if (!allowed.ok) return allowed;
  if (file.size > MAX_LOGO_BYTES) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_LOGO_TOO_LARGE, "logo is larger than 256 KB", {
        size: file.size,
      }),
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  signal.throwIfAborted();
  const info = imageSize(bytes);
  if (info === null) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_LOGO_INVALID, "logo must be a PNG or JPEG image"),
    );
  }
  if (info.width > MAX_LOGO_PX || info.height > MAX_LOGO_PX) {
    return err(
      new AppError(ERROR_IDS.EMAIL_DESIGN_LOGO_TOO_LARGE, "logo is over 2000 px on a side", {
        width: info.width,
        height: info.height,
      }),
    );
  }
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const [row] = await db
    .update(emailDesign)
    .set({
      logoBytes: bytes,
      logoMime: info.mime,
      logoHash: hash,
      logoWidth: info.width,
      logoHeight: info.height,
      updatedBy: allowed.value.id,
      updatedAt: new Date(),
    })
    .where(eq(emailDesign.id, 1))
    .returning(DESIGN_COLUMNS);
  signal.throwIfAborted();
  if (row === undefined) {
    return err(new AppError(ERROR_IDS.DB_INVARIANT, "email_design logo update returned no row"));
  }
  await recordAudit(
    db,
    {
      actorId: allowed.value.id,
      targetType: "settings",
      targetId: null,
      action: "email_design.updated",
      after: {
        logoHash: hash,
        logoMime: info.mime,
        logoWidth: info.width,
        logoHeight: info.height,
      },
    },
    signal,
  );
  return ok(await getEmailDesign(db, signal));
}

export async function removeEmailLogo(
  db: Db,
  actor: PermSetUser | null,
  signal: AbortSignal,
): Promise<Result<EmailDesignView, AppError>> {
  const allowed = admin(actor);
  if (!allowed.ok) return allowed;
  await db
    .update(emailDesign)
    .set({
      logoBytes: null,
      logoMime: null,
      logoHash: null,
      logoWidth: null,
      logoHeight: null,
      updatedBy: allowed.value.id,
      updatedAt: new Date(),
    })
    .where(eq(emailDesign.id, 1));
  signal.throwIfAborted();
  await recordAudit(
    db,
    {
      actorId: allowed.value.id,
      targetType: "settings",
      targetId: null,
      action: "email_design.updated",
      after: { logoHash: null },
    },
    signal,
  );
  return ok(await getEmailDesign(db, signal));
}

export interface StoredLogo {
  bytes: Buffer;
  mime: "image/png" | "image/jpeg";
}

// The public route's only read. It matches the exact hash and the extension that belongs to the
// stored type; no request path is ever used as a file path.
export async function getEmailLogo(
  db: Db,
  hash: string,
  ext: "png" | "jpg",
  signal: AbortSignal,
): Promise<StoredLogo | null> {
  const [row] = await db
    .select({ logoBytes: emailDesign.logoBytes, logoMime: emailDesign.logoMime })
    .from(emailDesign)
    .where(eq(emailDesign.logoHash, hash));
  signal.throwIfAborted();
  if (row === undefined || row.logoBytes === null || row.logoMime === null) return null;
  const expectedExt = row.logoMime === "image/jpeg" ? "jpg" : "png";
  if (ext !== expectedExt) return null;
  return { bytes: row.logoBytes, mime: row.logoMime as "image/png" | "image/jpeg" };
}
