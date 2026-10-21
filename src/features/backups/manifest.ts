// manifest.json sits next to db.dump inside every archive. It is what the restore script prints and
// what tells an operator which build and which migration the dump came from.

export type ManifestFile = { key: string; size: number };

export type BackupManifest = {
  version: 1;
  createdAt: string;
  appVersion: string;
  dbBytes: number;
  fileCount: number;
  files: ManifestFile[];
  schemaMigration: string;
};

export type ManifestInput = {
  createdAt: Date | string;
  appVersion: string;
  dbBytes: number;
  files: ManifestFile[];
  schemaMigration: string;
};

export function buildManifest(input: ManifestInput): BackupManifest {
  // Sorted by key so two runs over the same bucket produce byte-identical manifests.
  const files = [...input.files].sort((a, b) => a.key.localeCompare(b.key));
  return {
    version: 1,
    createdAt:
      typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString(),
    appVersion: input.appVersion,
    dbBytes: input.dbBytes,
    fileCount: files.length,
    files,
    schemaMigration: input.schemaMigration,
  };
}
