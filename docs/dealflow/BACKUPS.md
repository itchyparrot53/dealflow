# Backups

A daily job writes one archive to `BACKUP_DIR`: the `pg_dump` custom-format database dump, a copy
of every stored file, and `manifest.json` (created time, app version, latest migration, database
bytes, file list). Archives are named `dealflow-backup-{YYYY-MM-DD}T{HHMMSS}Z.tar.gz`.

## Schedule and retention

- The worker runs the job at 02:00 UTC when `BACKUP_ENABLED` is true.
- **Back up now** on Settings > Backups runs the same job immediately.
- The newest `BACKUP_KEEP` archives (1 to 90, default 7) are kept; older ones that match the exact
  archive name pattern are deleted. Foreign files in the directory are never touched.
- Only one backup runs at a time (a Postgres advisory lock); a second request reports the running
  one.

## What is not included

Secrets and configuration are not in the archive: `.env`, the compose files and the Docker volumes
other than the mirror of the storage bucket.

## Downloading

Admins can download a finished archive from Settings > Backups. The download route accepts only
names matching the archive pattern, so it cannot be used for path traversal.

## Restoring (CLI only, app stopped)

Copy the archive somewhere the worker can read, then on the server:

```bash
docker compose stop app worker ws
docker compose run --rm -v ./backups:/restore worker \
  node dist/backup-restore.mjs /restore/dealflow-backup-2026-10-21T020000Z.tar.gz \
  --files --yes
docker compose start app worker ws
```

Without `--files` only the database is restored. The script extracts the archive, prints the
manifest, refuses without `--yes`, runs `pg_restore --clean --if-exists --no-owner --no-privileges`
and optionally uploads the stored files back to the bucket.

## Keep a copy off the machine

Backups on the same disk do not survive a disk failure. Copy `BACKUP_DIR` to another machine or an
off-site location on your own schedule; this part has no off-site upload.
