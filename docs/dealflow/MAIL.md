# Mail: providers, IMAP/SMTP sync and sending

Dealflow talks to mailboxes through one provider interface, `MailProvider`
(`src/features/mail/provider/types.ts`). Gmail is one implementation; the IMAP/SMTP provider is the
other, and it is what Purelymail uses. A mailbox is an IMAP account when it has a
`mail_account_credentials` row, otherwise it resolves to the Gmail adapter.

## Connecting a mailbox

1. Open **Settings → Email sync**.
2. Enter the mailbox address and an **app password** from the provider (not the login password).
3. Keep **Purelymail** as the provider, or choose **Other IMAP/SMTP server** and fill in the IMAP and
   SMTP hosts and ports, the TLS switches, and an optional different username.
4. Press **Test and connect**. The server logs in over IMAP, checks that an INBOX exists, verifies
   SMTP, and only then stores the connection.

The password is encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256-GCM, the same helper as the Gmail
tokens) and is never returned to the browser or written to a log. **Update password** reopens the
form prefilled; **Disconnect** removes the stored credentials, so the mailbox falls back to Gmail if
that connection exists.

The Purelymail preset is `imap.purelymail.com:993` (TLS) and `smtp.purelymail.com:465` (TLS).
Custom servers are allowed for any IMAP/SMTP host.

## What sync does

- Mirrors INBOX, Sent, Archive, Junk and Trash; Drafts are ignored. Folders are found by their
  SPECIAL-USE flag (the leading backslash is stripped: `\Sent`), falling back to the folder name
  when a server sends no flags.
- Per-folder cursors store `UIDVALIDITY`, the last seen UID, `UIDNEXT` and `HIGHESTMODSEQ` (null when
  the server reports 0, which Purelymail does for an empty folder). A UIDVALIDITY change deletes that
  folder's cursor and locations and runs the initial pass again.
- The first pass covers the last `MAIL_INITIAL_SYNC_DAYS` (90) days. Older mail arrives through the
  `mail.backfill` job in 90-day windows until `MAIL_BACKFILL_DAYS` (365).
- New UIDs are fetched with `FETCH 1:* (UID)`, never `SEARCH`: Purelymail's SEARCH index lags behind
  an APPEND by several seconds.
- Threading uses `Message-ID`, `In-Reply-To` and `References`; a reply-looking message may also join
  a thread within 30 days with the same normalised subject and a shared participant.
- A message seen in two folders is stored once with two locations. A thread whose every location is
  Junk or Trash is marked trashed, and un-trashed as soon as one message is visible again.
- The worker keeps one IDLE connection per IMAP mailbox (measured 8 to 11 seconds for new mail on
  Purelymail) and polls every folder every `MAIL_SYNC_CADENCE_SECONDS` (90). `MAIL_IDLE_MAX` caps
  the IDLE connections.

## Sending

- Outgoing mail goes over SMTP. `Bcc` is stripped from the wire copy.
- Purelymail does not save a copy of SMTP-sent mail, so Dealflow APPENDs the full message (Bcc
  included, `\Seen`) to the Sent folder. The attempt is recorded in `mail_sent_appends` first; a
  failed APPEND never fails the send and is retried by the `mail.append-sent` job every five minutes,
  up to 12 tries.
- Replies carry `In-Reply-To` and `References` from the parent's stored headers.
- Limits: `MAIL_SEND_MAX_RECIPIENTS` (250) per message, refused before queueing, and
  `MAIL_SEND_DAILY_RECIPIENTS` (2,800) per rolling 24 hours. Over the daily limit a send is deferred
  (rescheduled for when the oldest counted send leaves the window), never silently dropped.
- Message-IDs use the sending mailbox's domain, for example `<id.key@umev.co.uk>`.

## Attachments and trash

Attachments are not stored. A download re-fetches the message source from its first known location,
parses it again and returns the `idx:{n}` attachment. A message above `MAIL_MAX_MESSAGE_BYTES` (15
MiB) stores headers and a "too large to preview" body instead.

Deleting a thread in the CRM MOVEs its messages to the mailbox's Trash folder and updates the stored
locations. Gmail keeps using its own trash call through the Gmail adapter.

## Notifications

Notification email no longer depends on a connected mailbox: it goes through the Part 1 system
mailer (`SMTP_HOST` and friends, or the capture mailer when `MAIL_FAKE=true`).

## The fake transport

`MAIL_PROVIDER_FAKE_DIR` switches every IMAP account to a filesystem fake behind the same transport
interfaces. Tests and e2e use it, so no test touches a real server.

```
{dir}/{address}/password                    first login creates it, later logins must match
{dir}/{address}/{Folder}/meta.json          { uidValidity, uidNext, modseq }
{dir}/{address}/{Folder}/{uid}.eml          raw RFC 822
{dir}/_smtp/{timestamp}-{n}.json            { from, to, size } for every send
```

Helpers live in `src/features/mail/transport/fakeStore.ts` (`fakeDeliver`, `fakeAppend`,
`fakeList`, `fakeMove`, `fakeResetUidValidity`). A password shorter than 8 characters is rejected
with `E_MAIL_004`, which is how the settings error path is tested.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `MAIL_PROVIDER_FAKE_DIR` | empty | Non-empty uses the filesystem fake for every IMAP account |
| `MAIL_INITIAL_SYNC_DAYS` | 90 | First pass window |
| `MAIL_BACKFILL_DAYS` | 365 | How far the background backfill walks back |
| `MAIL_SYNC_CADENCE_SECONDS` | 90 | Poll interval per mailbox |
| `MAIL_IDLE_MAX` | 50 | Maximum live IDLE connections |
| `MAIL_MAX_MESSAGE_BYTES` | 15728640 | Above this, headers and a preview are stored |
| `MAIL_SEND_DAILY_RECIPIENTS` | 2800 | Rolling 24-hour recipient budget |
| `MAIL_SEND_MAX_RECIPIENTS` | 250 | Recipients per message |

## Live check

`pnpm mail:live-check` proves the real transports, the parser and the thread keys against a
Purelymail test mailbox. It sends two messages from that mailbox to itself, appends both to
Sent, waits for them in INBOX, checks that the received copy has no `Bcc`, checks that the reply
references the first message, searches Sent by Message-ID and moves both inbound copies to Trash.
It needs `MAIL_PROBE_USER` and `MAIL_PROBE_PASS` in `.env`; without them it writes
`docs/dealflow/mail-live-check.json` (gitignored) with `"status": "skipped"`.
