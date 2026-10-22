import { CACHE_PREFIX, OFFLINE_DB_PREFIX } from "@/constants/pwa";
import { err, ok, type Result } from "@/types/result";
import type { OfflineRecordType, OfflineSnapshot } from "./snapshots";

// One IndexedDB store per record type, opened per user. There is no `idb` dependency: the wrapper
// is small and every entry point resolves a Result, so a private window or blocked storage simply
// turns the offline feature off instead of throwing into a render.
export const OFFLINE_STORES: readonly OfflineRecordType[] = [
  "deal",
  "person",
  "organization",
  "today",
];

// The today snapshot is one rolling list, so its store uses an out-of-line key.
const TODAY_KEY = "today";

export function offlineDbName(userId: string): string {
  return `${OFFLINE_DB_PREFIX}${userId}`;
}

function requestResult<T>(request: IDBRequest<T>): Promise<Result<T, string>> {
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(ok(request.result));
    request.onerror = () => resolve(err(request.error?.message ?? "indexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<Result<void, string>> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(ok(undefined));
    tx.onerror = () => resolve(err(tx.error?.message ?? "indexedDB transaction failed"));
    tx.onabort = () => resolve(err(tx.error?.message ?? "indexedDB transaction aborted"));
  });
}

function openOfflineDb(userId: string): Promise<Result<IDBDatabase, string>> {
  if (typeof indexedDB === "undefined") return Promise.resolve(err("indexedDB is unavailable"));
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(offlineDbName(userId), 1);
    } catch {
      resolve(err("could not open the offline database"));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of OFFLINE_STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        // "today" has no id column, so it is keyed explicitly; the others use the snapshot's id.
        if (name === "today") db.createObjectStore(name);
        else db.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(ok(request.result));
    request.onerror = () =>
      resolve(err(request.error?.message ?? "could not open the offline database"));
    request.onblocked = () => resolve(err("the offline database is blocked by another tab"));
  });
}

export async function putOfflineRecord(
  userId: string,
  snapshot: OfflineSnapshot,
): Promise<Result<void, string>> {
  const db = await openOfflineDb(userId);
  if (!db.ok) return db;
  try {
    const tx = db.value.transaction(snapshot.type, "readwrite");
    const store = tx.objectStore(snapshot.type);
    // A re-saved deal/person/org replaces the copy with the same id (keyPath does that for us).
    if (snapshot.type === "today") store.put(snapshot, TODAY_KEY);
    else store.put(snapshot);
    const done = await transactionDone(tx);
    db.value.close();
    return done;
  } catch {
    db.value.close();
    return err("could not write the offline record");
  }
}

export async function getAllOfflineRecords(
  userId: string,
  type: OfflineRecordType,
): Promise<Result<OfflineSnapshot[], string>> {
  const db = await openOfflineDb(userId);
  if (!db.ok) return err(db.error);
  try {
    const tx = db.value.transaction(type, "readonly");
    const request = tx.objectStore(type).getAll() as IDBRequest<OfflineSnapshot[]>;
    const result = await requestResult(request);
    db.value.close();
    return result;
  } catch {
    db.value.close();
    return err("could not read the offline records");
  }
}

export async function getOfflineRecord(
  userId: string,
  type: OfflineRecordType,
  id: string,
): Promise<Result<OfflineSnapshot | undefined, string>> {
  const db = await openOfflineDb(userId);
  if (!db.ok) return err(db.error);
  try {
    const tx = db.value.transaction(type, "readonly");
    const request = tx.objectStore(type).get(type === "today" ? TODAY_KEY : id) as IDBRequest<
      OfflineSnapshot | undefined
    >;
    const result = await requestResult(request);
    db.value.close();
    return result;
  } catch {
    db.value.close();
    return err("could not read the offline record");
  }
}

export async function deleteOfflineRecord(
  userId: string,
  type: OfflineRecordType,
  id: string,
): Promise<Result<void, string>> {
  const db = await openOfflineDb(userId);
  if (!db.ok) return db;
  try {
    const tx = db.value.transaction(type, "readwrite");
    tx.objectStore(type).delete(type === "today" ? TODAY_KEY : id);
    const done = await transactionDone(tx);
    db.value.close();
    return done;
  } catch {
    db.value.close();
    return err("could not delete the offline record");
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearAppCaches(failures: string[]): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name)),
    );
  } catch {
    failures.push("could not clear the app caches");
  }
}

// Every offline database this browser knows about. databases() is not available everywhere, so
// the last known user id is always included as a fallback.
async function offlineDatabaseNames(knownUserId: string | null): Promise<string[]> {
  const names = new Set<string>();
  if (knownUserId !== null) names.add(offlineDbName(knownUserId));
  const factory = indexedDB as IDBFactory & {
    databases?: () => Promise<IDBDatabaseInfo[]>;
  };
  if (typeof factory.databases !== "function") return [...names];
  try {
    for (const info of await factory.databases()) {
      const name = info.name ?? "";
      if (name.startsWith(OFFLINE_DB_PREFIX)) names.add(name);
    }
  } catch {
    // Fall back to the known user id.
  }
  return [...names];
}

// Wipes every offline database and every app cache. Used on sign-out and when a different user
// signs in on this device, so one person's records never show up for the next.
export async function deleteAllOfflineData(
  knownUserId: string | null = null,
): Promise<Result<void, string>> {
  const failures: string[] = [];
  await clearAppCaches(failures);
  if (typeof indexedDB !== "undefined") {
    const names = await offlineDatabaseNames(knownUserId);
    await Promise.all(names.map((name) => deleteDatabase(name)));
  }
  return failures.length === 0 ? ok(undefined) : err(failures.join("; "));
}
