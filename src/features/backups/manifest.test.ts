import { describe, expect, it } from "vitest";
import { buildManifest } from "./manifest";

describe("buildManifest", () => {
  it("writes version 1 with the database and file summary", () => {
    const manifest = buildManifest({
      createdAt: new Date("2026-10-21T02:00:00.000Z"),
      appVersion: "1.2.0",
      dbBytes: 4096,
      files: [
        { key: "deals/b.pdf", size: 12 },
        { key: "avatars/a.png", size: 8 },
      ],
      schemaMigration: "0090_dealflow_projects_notifications",
    });
    expect(manifest).toEqual({
      version: 1,
      createdAt: "2026-10-21T02:00:00.000Z",
      appVersion: "1.2.0",
      dbBytes: 4096,
      fileCount: 2,
      files: [
        { key: "avatars/a.png", size: 8 },
        { key: "deals/b.pdf", size: 12 },
      ],
      schemaMigration: "0090_dealflow_projects_notifications",
    });
  });

  it("accepts an already-ISO createdAt string", () => {
    const manifest = buildManifest({
      createdAt: "2026-10-21T02:00:00.000Z",
      appVersion: "dev",
      dbBytes: 0,
      files: [],
      schemaMigration: "0090",
    });
    expect(manifest.createdAt).toBe("2026-10-21T02:00:00.000Z");
    expect(manifest.fileCount).toBe(0);
  });
});
