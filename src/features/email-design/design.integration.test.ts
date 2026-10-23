import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as logoRoute } from "@/app/email-assets/logo/[file]/route";
import { ERROR_IDS } from "@/constants/errorIds";
import { emailDesign } from "@/db/schema";
import { seedUser } from "@/db/testing/factories";
import type { PermSetUser } from "@/features/permissions/effective";
import { makeTestDb, type TestDb } from "@/test/db";
import {
  getEmailDesign,
  getEmailLogo,
  removeEmailLogo,
  saveEmailDesign,
  uploadEmailLogo,
} from "./design";

let h: TestDb;
let admin: PermSetUser;
let regular: PermSetUser;

vi.mock("@/db/client", () => ({
  get db() {
    return h.db;
  },
  get pool() {
    return h.pool;
  },
}));

const sig = (): AbortSignal => AbortSignal.timeout(20_000);

function toActor(row: { id: string; isAdmin: boolean }): PermSetUser {
  return {
    id: row.id,
    type: row.isAdmin ? "admin" : "regular",
    isActive: true,
    groupIds: new Set(),
    flags: new Set(),
  };
}

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function uploadFile(bytes: Buffer): { size: number; arrayBuffer: () => Promise<ArrayBuffer> } {
  return {
    size: bytes.length,
    arrayBuffer: async () => new Uint8Array(bytes).buffer as ArrayBuffer,
  };
}

beforeAll(async () => {
  h = await makeTestDb();
  admin = toActor(await seedUser(h.db, { isAdmin: true }));
  regular = toActor(await seedUser(h.db));
});

afterAll(async () => {
  await h.close();
});

describe("email design storage", () => {
  it("uploads a logo, serves it from the public route and refuses a wrong hash or extension", async () => {
    const bytes = png(240, 60);
    const uploaded = await uploadEmailLogo(h.db, admin, uploadFile(bytes), sig());
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    expect(uploaded.value.logo?.width).toBe(240);
    expect(uploaded.value.logo?.height).toBe(60);
    const hash = uploaded.value.logo?.url.match(/logo\/([0-9a-f]{16})\.png/)?.[1];
    expect(hash).toBeDefined();

    const stored = await getEmailLogo(h.db, hash ?? "", "png", sig());
    expect(stored?.mime).toBe("image/png");
    expect(stored?.bytes.equals(bytes)).toBe(true);

    const response = await logoRoute(
      new NextRequest(`http://localhost/email-assets/logo/${hash ?? ""}.png`),
      { params: Promise.resolve({ file: `${hash ?? ""}.png` }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await response.arrayBuffer()).equals(bytes)).toBe(true);

    const wrongHash = await logoRoute(
      new NextRequest("http://localhost/email-assets/logo/0000000000000000.png"),
      { params: Promise.resolve({ file: "0000000000000000.png" }) },
    );
    expect(wrongHash.status).toBe(404);

    const wrongExt = await logoRoute(
      new NextRequest(`http://localhost/email-assets/logo/${hash ?? ""}.jpg`),
      { params: Promise.resolve({ file: `${hash ?? ""}.jpg` }) },
    );
    expect(wrongExt.status).toBe(404);
  });

  it("rejects a non-image and an oversized logo", async () => {
    const notImage = await uploadEmailLogo(
      h.db,
      admin,
      uploadFile(Buffer.from("not an image")),
      sig(),
    );
    expect(notImage.ok).toBe(false);
    if (!notImage.ok) expect(notImage.error.id).toBe("E_EMAIL_DESIGN_002");

    const oversized = await uploadEmailLogo(h.db, admin, uploadFile(png(2400, 60)), sig());
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error.id).toBe("E_EMAIL_DESIGN_003");
  });

  it("saves the design for admins only, rejects a pale accent and audits the save", async () => {
    const denied = await saveEmailDesign(
      h.db,
      regular,
      {
        displayName: "Northwind",
        accentColor: "#2D8548",
        showAddress: true,
        footerText: null,
        showPoweredBy: false,
        newEmailLayout: "branded",
        replyLayout: "minimal",
        footerOnReplies: false,
      },
      sig(),
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.id).toBe(ERROR_IDS.PERM_DENIED);

    const pale = await saveEmailDesign(
      h.db,
      admin,
      {
        displayName: "Northwind",
        accentColor: "#9BE7B3",
        showAddress: true,
        footerText: null,
        showPoweredBy: false,
        newEmailLayout: "branded",
        replyLayout: "minimal",
        footerOnReplies: false,
      },
      sig(),
    );
    expect(pale.ok).toBe(false);

    const saved = await saveEmailDesign(
      h.db,
      admin,
      {
        displayName: "Northwind Studio",
        accentColor: "#1F5FBF",
        showAddress: true,
        footerText: "Sent by Northwind.",
        showPoweredBy: true,
        newEmailLayout: "branded",
        replyLayout: "minimal",
        footerOnReplies: true,
      },
      sig(),
    );
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.displayName).toBe("Northwind Studio");
    expect(saved.value.accentColor).toBe("#1F5FBF");

    // A fresh read comes back from the row, not from the in-memory result.
    const read = await getEmailDesign(h.db, sig());
    expect(read.displayName).toBe("Northwind Studio");
    expect(read.footerOnReplies).toBe(true);

    // Removing the logo clears the stored bytes and the public route stops serving it.
    const removed = await removeEmailLogo(h.db, admin, sig());
    expect(removed.ok).toBe(true);
    const [row] = await h.db.select().from(emailDesign);
    expect(row?.logoHash).toBeNull();
    expect(row?.logoBytes).toBeNull();
  });
});
