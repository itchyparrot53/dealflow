"use client";
import { useEffect } from "react";
import { OFFLINE_KEEP_PER_TYPE } from "@/constants/pwa";
import { deleteOfflineRecord, getAllOfflineRecords, putOfflineRecord } from "./db";
import type { OfflineSnapshot } from "./snapshots";
import { trimToNewest } from "./trim";
import { syncOfflineUser } from "./wipe";

// Writes a compact snapshot after the page has mounted, then trims that type to the newest N. The
// snapshot is serialized so an inline object literal rebuilt on every render does not re-run the
// effect; only a change in content does.
export function RememberRecord({
  userId,
  snapshot,
}: {
  userId: string;
  snapshot: OfflineSnapshot;
}): null {
  const serialized = JSON.stringify(snapshot);

  useEffect(() => {
    const parsed = JSON.parse(serialized) as OfflineSnapshot;
    // An object rather than a boolean: the cleanup mutates it from another closure, which the
    // compiler's flow analysis cannot see through a plain `let`.
    const run = { cancelled: false };
    const cancelled = (): boolean => run.cancelled;
    void (async () => {
      const written = await putOfflineRecord(userId, parsed);
      if (!written.ok || cancelled()) return;
      // The today list is a single rolling snapshot, so there is nothing to trim.
      if (parsed.type === "today") return;
      const all = await getAllOfflineRecords(userId, parsed.type);
      if (!all.ok || cancelled()) return;
      const saved = all.value.filter(
        (record): record is Exclude<OfflineSnapshot, { type: "today" }> => record.type !== "today",
      );
      const keep = trimToNewest(saved, OFFLINE_KEEP_PER_TYPE);
      const kept = new Set(keep.map((record) => record.id));
      await Promise.all(
        saved
          .filter((record) => !kept.has(record.id))
          .map((record) => deleteOfflineRecord(userId, parsed.type, record.id)),
      );
    })();
    return () => {
      run.cancelled = true;
    };
  }, [userId, serialized]);

  return null;
}

// Mounted in the app shell: records the signed-in user, and wipes the previous user's offline
// data when someone else signs in on this browser profile.
export function OfflineUserSync({ userId }: { userId: string }): null {
  useEffect(() => {
    void syncOfflineUser(userId);
  }, [userId]);
  return null;
}
