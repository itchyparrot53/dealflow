// Retention for the offline store: newest first, one copy per id. A record re-opened later
// replaces its earlier copy instead of counting against the keep limit twice.
export type SavedRecord = { id: string; savedAt: string };

export function trimToNewest<T extends SavedRecord>(records: readonly T[], keep: number): T[] {
  if (keep <= 0) return [];
  const newestById = new Map<string, T>();
  for (const record of records) {
    const existing = newestById.get(record.id);
    // ">=" so a re-save with the same timestamp still replaces the earlier copy.
    if (existing === undefined || record.savedAt >= existing.savedAt) {
      newestById.set(record.id, record);
    }
  }
  return [...newestById.values()]
    .sort((a, b) => {
      if (a.savedAt === b.savedAt) return 0;
      return a.savedAt < b.savedAt ? 1 : -1;
    })
    .slice(0, keep);
}
