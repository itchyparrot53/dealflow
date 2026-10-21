// Backup retention is name-based on purpose: the directory may hold other files, and a prune that
// deleted everything except the newest N would delete them too. Only our own archive names are
// candidates, and an impossible timestamp inside a matching name is ignored rather than deleted.

const BACKUP_NAME = /^dealflow-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z\.tar\.gz$/;

export function backupFileName(now: Date): string {
  const iso = now.toISOString();
  return `dealflow-backup-${iso.slice(0, 4)}-${iso.slice(5, 7)}-${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z.tar.gz`;
}

export function isBackupFileName(name: string): boolean {
  return BACKUP_NAME.test(name);
}

// Epoch milliseconds for a name we wrote, or null for anything else (foreign names, bad timestamps).
function timestampOf(name: string): number | null {
  const match = BACKUP_NAME.exec(name);
  if (match === null) return null;
  // Number(undefined) is NaN, so a malformed group can never pass the round-trip check below.
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const time = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(time);
  const roundTrips =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day &&
    check.getUTCHours() === hour &&
    check.getUTCMinutes() === minute &&
    check.getUTCSeconds() === second;
  return roundTrips ? time : null;
}

// The archives to delete so that only the newest `keep` remain. Oldest first, so a partial delete
// still leaves the newest set intact.
export function filesToPrune(names: string[], keep: number): string[] {
  const kept = Math.max(0, keep);
  const ours = names
    .map((name) => ({ name, time: timestampOf(name) }))
    .filter((entry): entry is { name: string; time: number } => entry.time !== null)
    .sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
  return ours.slice(0, Math.max(0, ours.length - kept)).map((entry) => entry.name);
}
