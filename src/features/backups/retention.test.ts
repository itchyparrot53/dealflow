import { describe, expect, it } from "vitest";
import { backupFileName, filesToPrune } from "./retention";

function name(iso: string): string {
  return `dealflow-backup-${iso.replace(/[-:]/g, "").replace(".000", "")}.tar.gz`;
}

describe("backupFileName", () => {
  it("stamps the UTC time into the archive name", () => {
    expect(backupFileName(new Date("2026-10-21T02:00:00.000Z"))).toBe(
      "dealflow-backup-2026-10-21T020000Z.tar.gz",
    );
    expect(backupFileName(new Date("2027-01-02T13:04:05.678Z"))).toBe(
      "dealflow-backup-2027-01-02T130405Z.tar.gz",
    );
  });
});

describe("filesToPrune", () => {
  const names = [
    "dealflow-backup-2026-10-18T020000Z.tar.gz",
    "dealflow-backup-2026-10-21T020000Z.tar.gz",
    "dealflow-backup-2026-10-19T020000Z.tar.gz",
    "dealflow-backup-2026-10-20T020000Z.tar.gz",
  ];

  it("keeps the newest N and returns the older ones by timestamp order", () => {
    expect(filesToPrune(names, 2)).toEqual([
      "dealflow-backup-2026-10-18T020000Z.tar.gz",
      "dealflow-backup-2026-10-19T020000Z.tar.gz",
    ]);
  });

  it("returns nothing when the count is at or under the keep limit", () => {
    expect(filesToPrune(names, 4)).toEqual([]);
    expect(filesToPrune(names, 9)).toEqual([]);
    expect(filesToPrune([], 3)).toEqual([]);
  });

  it("prunes everything when keep is zero", () => {
    expect(filesToPrune(names, 0)).toHaveLength(4);
  });

  it("ignores foreign names instead of deleting them", () => {
    const mixed = [
      "notes.txt",
      "dealflow-backup-latest.tar.gz",
      "dealflow-backup-2026-10-21T020000Z.tar.gz.bak",
      "other-backup-2026-10-18T020000Z.tar.gz",
      "dealflow-backup-2026-10-18T020000Z.tar.gz",
      "dealflow-backup-2026-10-19T020000Z.tar.gz",
      "dealflow-backup-2026-10-20T020000Z.tar.gz",
    ];
    expect(filesToPrune(mixed, 1)).toEqual([
      "dealflow-backup-2026-10-18T020000Z.tar.gz",
      "dealflow-backup-2026-10-19T020000Z.tar.gz",
    ]);
  });

  it("ignores a matching name with an impossible timestamp", () => {
    expect(
      filesToPrune(
        ["dealflow-backup-2026-13-45T990000Z.tar.gz", name("2026-10-21T02:00:00.000Z")],
        1,
      ),
    ).toEqual([]);
  });
});
