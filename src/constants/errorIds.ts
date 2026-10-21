// Stable error-ID registry. Append-only: one ID per distinct cause; retired IDs
// stay searchable (commented) and are never reused or renumbered.
export const ERROR_IDS = {
  // AUTH
  AUTH_LOGIN_REJECTED: "E_AUTH_001", // domain / email_verified / signature check failed
  AUTH_STATE_MISMATCH: "E_AUTH_002", // OAuth state/nonce/PKCE mismatch
  AUTH_SESSION_DEAD: "E_AUTH_003", // session revoked or expired
  AUTH_BOOTSTRAP_NO_SEED: "E_AUTH_004", // first-run with no SEED_ADMIN_EMAIL in prod
  AUTH_EMAIL_TAKEN: "E_AUTH_005", // inviteUser: email already belongs to an existing/placeholder user
  AUTH_INVITE_INPUT_INVALID: "E_AUTH_006", // inviteUserAction input failed Zod validation
  AUTH_INVALID_CREDENTIALS: "E_AUTH_007", // email/password pair rejected (also unknown email)
  AUTH_LOCKED: "E_AUTH_008", // too many failed password attempts; locked until lockedUntil
  AUTH_TOKEN_INVALID: "E_AUTH_009", // magic/invite/setup token unknown, expired, used or wrong kind
  AUTH_PASSWORD_WEAK: "E_AUTH_010", // password outside 12..128 characters
  AUTH_METHOD_DISABLED: "E_AUTH_011", // sign-in method turned off by env
  AUTH_ORIGIN_REJECTED: "E_AUTH_012", // unauthenticated POST failed the same-origin check
  AUTH_PASSWORD_MISMATCH: "E_AUTH_013", // current password wrong on change
  AUTH_INPUT_INVALID: "E_AUTH_014", // auth form or action input failed Zod validation
  // PERM
  PERM_DENIED: "E_PERM_001", // channel subscribe / action denied: not visible
  PERM_SELF_ESCALATION: "E_PERM_002", // non-admin tried to escalate via permission system
  PERM_GROUP_REQUIRED: "E_PERM_003", // group-level create with no resolvable group
  PERM_SIGNATURE_DENIED: "E_PERM_004", // signature not found or not owned by actor
  PERM_TEMPLATE_DENIED: "E_PERM_005", // template not found or not accessible (not owned, not shared)
  // WS
  WS_TICKET_INVALID: "E_WS_001", // upgrade rejected: invalid/expired/replayed ticket
  WS_PAYLOAD_INVALID: "E_WS_002", // NOTIFY payload failed Zod, dropped
  // DB
  DB_INVARIANT: "E_DB_001", // a DB invariant we believed impossible was violated
  DB_INSERT_FAILED: "E_DB_002", // insert returned no rows (should never happen)
  DB_WRITE_FAILED: "E_DB_003", // the write threw: Postgres unreachable, aborted, or rejected
  // DEAL
  DEAL_NOT_FOUND: "E_DEAL_001", // deal not found or not visible (404-on-invisible)
  DEAL_PRECONDITION: "E_DEAL_002", // optimistic precondition failed (stale compare-and-swap on move)
  DEAL_STAGE_MISMATCH: "E_DEAL_003", // stage does not belong to that pipeline
  DEAL_LOST_REASON_REQUIRED: "E_DEAL_004", // RETIRED 2026-07-04: a lost reason is required to mark a deal lost
  DEAL_LOST_REASON_INVALID: "E_DEAL_005", // lost_reason_id does not exist or is archived
  DEAL_ARCHIVED_NO_ACTIVITY: "E_DEAL_006", // cannot link a new activity to an archived deal
  DEAL_SAVED_FILTER_NOT_FOUND: "E_DEAL_007", // saved filter not found or not owned by the actor (delete guard)
  DEAL_FILTER_INVALID: "E_DEAL_008", // saved-filter input failed Zod validation (bad field/op pairing or value)
  DEAL_LOST_INPUT_INVALID: "E_DEAL_009", // markLost action input failed Zod validation
  DEAL_MERGE_SAME: "E_DEAL_010", // mergeDeals: source and target are the same deal
  DEAL_DUPLICATE_INPUT_INVALID: "E_DEAL_011", // duplicateDeal action input failed Zod validation
  DEAL_CONVERT_INPUT_INVALID: "E_DEAL_012", // convertDealToLead action input failed Zod validation
  DEAL_MERGE_INPUT_INVALID: "E_DEAL_013", // mergeDeals action input failed Zod validation
  DEAL_BULK_INPUT_INVALID: "E_DEAL_015",
  DEAL_BULK_ARCHIVE_PARTIAL: "E_DEAL_016",
  DEAL_BULK_STAGE_PARTIAL: "E_DEAL_017",
  // LEAD
  LEAD_NOT_FOUND: "E_LEAD_001", // lead not found or not visible (404-on-invisible)
  LEAD_ARCHIVE_FORBIDDEN: "E_LEAD_002", // archive denied: lead not visible/owned by actor
  LEAD_ALREADY_CONVERTED: "E_LEAD_003", // convert called on a lead with a non-null converted_deal_id
  LEAD_CONVERT_NO_PIPELINE: "E_LEAD_004", // convert: no target pipeline resolvable (none passed, no default)
  LEAD_BULK_CONVERT_INPUT_INVALID: "E_LEAD_005", // bulkConvertLeadsAction input failed Zod validation
  LEAD_UPDATE_INPUT_INVALID: "E_LEAD_006", // updateLeadAction input failed Zod validation
  LEAD_PRECONDITION: "E_LEAD_007", // optimistic precondition failed (stale compare-and-swap on updateLead)
  LEAD_FILTER_INVALID: "E_LEAD_008", // leads list filter compiled with a field/op outside the allow-list
  // PIPELINE
  PIPELINE_NOT_FOUND: "E_PIPELINE_001", // pipeline not found or restricted (404-on-invisible)
  // STAGE
  STAGE_NOT_FOUND: "E_STAGE_001", // stage not found (delete/update targeted a missing stage)
  STAGE_HAS_DEALS: "E_STAGE_002", // refuse to delete a stage that still holds deals (move them first)
  STAGE_LAST_ONE: "E_STAGE_003", // refuse to delete the pipeline's final stage (a pipeline needs one)
  STAGE_MOVE_TARGET_INVALID: "E_STAGE_004", // delete's move destination is the stage itself or outside its pipeline
  // CF
  CF_KEY_EXISTS: "E_CF_001", // custom-field key already exists for target
  CF_DEF_NOT_FOUND: "E_CF_002", // custom-field def not found
  CF_VALUE_INVALID: "E_CF_003", // custom-field value validation failed
  CF_INPUT_INVALID: "E_CF_004", // custom-field create/archive input failed Zod validation
  CF_BUILTIN_LOCKED: "E_CF_005", // attempted to hide a locked (identity) built-in field
  CF_BUILTIN_UNKNOWN: "E_CF_006", // attempted to hide an unknown built-in field key
  CF_SORT_FIELD_INVALID: "E_CF_007", // list sort names an unknown, archived or unsortable custom field
  // CONTACT
  CONTACT_NOT_FOUND: "E_CONTACT_001", // person/org not found OR not visible (404-shaped)
  CONTACT_ADDRESS_INVALID: "E_CONTACT_002", // structured address failed validation
  CONTACT_MERGE_FORBIDDEN: "E_CONTACT_003", // merge denied: lacks contact.merge on a visible record
  CONTACT_MERGE_SAME: "E_CONTACT_004", // merge survivor and merged are the same id
  CONTACT_RELATION_SELF: "E_CONTACT_005", // addOrgRelation: source and target are the same org
  CONTACT_RELATION_INPUT_INVALID: "E_CONTACT_006", // add/removeOrgRelationAction input failed Zod validation
  CONTACT_FOLLOW_INPUT_INVALID: "E_CONTACT_007", // follow/unfollowContactAction input failed Zod validation
  CONTACT_FILTER_INVALID: "E_CONTACT_009", // contacts list filter compiled with a field/op outside the allow-list
  CONTACT_UPDATE_INPUT_INVALID: "E_CONTACT_008", // updatePersonAction/updateOrgAction input failed Zod validation
  CONTACT_CREATE_INPUT_INVALID: "E_CONTACT_010", // createPersonAction input failed Zod validation
  // NOTE
  NOTE_NOT_FOUND: "E_NOTE_001", // note not found or soft-deleted
  COMMENT_NOT_FOUND: "E_COMMENT_001",
  COMMENT_FORBIDDEN: "E_COMMENT_002",
  COMMENT_ENTITY_UNSUPPORTED: "E_COMMENT_003",
  COMMENT_INPUT_INVALID: "E_COMMENT_004",
  // IMPORT
  IMPORT_ROW_GONE: "E_IMPORT_001", // import row vanished before commit could claim it
  IMPORT_BATCH_NOT_FOUND: "E_IMPORT_002", // import batch not found or not owned (404-on-invisible)
  IMPORT_MAPPING_MISSING: "E_IMPORT_003", // validate/commit before a column mapping was set
  IMPORT_UPLOAD_INCOMPLETE: "E_IMPORT_004", // confirm before the object landed, or it exceeds the cap
  IMPORT_PARSE_FAILED: "E_IMPORT_005", // prepare job could not read/parse the uploaded CSV
  IMPORT_NOT_UNDOABLE: "E_IMPORT_006", // undo requested on a batch not in completed/partial
  IMPORT_BAD_STATE: "E_IMPORT_007", // mapping/commit requested on a batch in an illegal status
  IMPORT_MAPPING_ENTITY_INVALID: "E_IMPORT_008", // mapped column targets an entity this import cannot write
  // USER (reference)
  USER_NOT_FOUND: "E_USER_001", // referenced user not found or inactive
  USER_PROFILE_INVALID: "E_USER_002", // profile update input failed Zod validation
  USER_AVATAR_INVALID: "E_USER_003", // avatar upload input/object metadata failed validation
  // ACTIVITY
  ACTIVITY_NOT_FOUND: "E_ACTIVITY_001", // activity not found or not visible (404-on-invisible)
  ACTIVITY_FORBIDDEN: "E_ACTIVITY_002", // visible but action flag missing (403-shape)
  ACTIVITY_TYPE_IN_USE: "E_ACTIVITY_003", // delete blocked: activity type is a system row or still referenced by an activity
  ACTIVITY_TYPE_KEY_EXISTS: "E_ACTIVITY_004", // create blocked: an activity type with that key already exists
  ACTIVITY_UPDATE_INPUT_INVALID: "E_ACTIVITY_005", // edit action input failed Zod validation
  ACTIVITY_TYPE_INVALID: "E_ACTIVITY_006", // patched typeId is missing or archived (activity WAS found)
  ACTIVITY_END_BEFORE_START: "E_ACTIVITY_007", // multi-day endAt is earlier than the start (dueAt)
  // LABEL
  LABEL_NOT_FOUND: "E_LABEL_001", // label not found (rename/recolor/delete targeted a missing label)
  LABEL_IN_USE: "E_LABEL_002", // delete blocked: label still applied to one or more records
  // LOST_REASON
  LOST_REASON_NOT_FOUND: "E_LOSTREASON_001", // lost reason not found (rename/archive targeted a missing row)
  // GMAIL
  GMAIL_API_EXHAUSTED: "E_GMAIL_001", // Gmail API call failed after retries (transient exhausted)
  GMAIL_GRANT_REVOKED: "E_GMAIL_002", // OAuth grant revoked/expired (invalid_grant): account disconnected
  GMAIL_SEND_REJECTED: "E_GMAIL_003", // Send rejected pre-acceptance (4xx validation): safe to retry
  GMAIL_RECONCILE_EXHAUSTED: "E_GMAIL_004", // Reconcile window exhausted, send moved to needs_review
  GMAIL_TOKEN_DECRYPT_FAILED: "E_GMAIL_005", // token decrypt/auth-tag failure (server-side key/data problem, NOT a grant revocation)
  GMAIL_ADDRESS_TAKEN: "E_GMAIL_006", // Gmail address already bound to another user (email_address unique violation)
  GMAIL_RECONCILE_PENDING: "E_GMAIL_007", // reconcile within window: not found yet, retry later (control-flow, not an API failure)
  GMAIL_CLAIM_CONTENDED: "E_GMAIL_008", // outbox claim/stamp race lost to another worker (control-flow, not an API failure)
  GMAIL_SEND_INPUT_INVALID: "E_GMAIL_009", // interactive send input failed Zod validation (bad request)
  GMAIL_AUTHORING_INPUT_INVALID: "E_GMAIL_010", // template/signature input failed Zod validation (bad request)
  GMAIL_THREAD_NOT_FOUND: "E_GMAIL_011", // email thread not found OR not visible to actor (404-on-invisible, mailbox privacy)
  GMAIL_ATTACHMENT_DENIED: "E_GMAIL_012", // attachment file not found or not readable by the actor (authz failure)
  GMAIL_DISCONNECT_INPUT_INVALID: "E_GMAIL_013", // disconnect mailbox action input failed Zod validation (bad request)
  GMAIL_DRAFT_NOT_FOUND: "E_GMAIL_014", // draft not found or not owned by actor (resume/delete guard)
  GMAIL_DRAFT_INPUT_INVALID: "E_GMAIL_015", // save-draft input failed Zod validation (bad request)
  GMAIL_OUTBOX_NOT_FOUND: "E_GMAIL_016", // outbox send-attempt not found or not owned by actor
  GMAIL_OUTBOX_NOT_CANCELABLE: "E_GMAIL_017", // attempt is claimed or already sent: cannot cancel
  GMAIL_FOLDER_INPUT_INVALID: "E_GMAIL_018", // archive/unarchive/cancel input failed Zod validation
  GMAIL_READ_INPUT_INVALID: "E_GMAIL_019", // mark-read/unread action input failed Zod validation
  GMAIL_ATTACHMENT_INPUT_INVALID: "E_GMAIL_020", // download route attachmentId param failed Zod (bad request, not a visibility denial)
  GMAIL_ATTR_INPUT_INVALID: "E_GMAIL_021", // follow-up status / labels action input failed Zod validation
  GMAIL_VISIBILITY_INPUT_INVALID: "E_GMAIL_022", // set-thread-visibility action input failed Zod validation
  GMAIL_TRASH_INPUT_INVALID: "E_GMAIL_023", // trash-thread action input failed Zod validation
  GMAIL_MAIL_LABEL_INPUT_INVALID: "E_GMAIL_024", // create-mail-label action input failed Zod validation (U6)
  GMAIL_MAIL_LABEL_UNKNOWN: "E_GMAIL_025", // thread-labels write referenced a key absent from the mail_labels catalog (integrity: would persist an invisible, unremovable label)
  GMAIL_MESSAGE_NOT_FOUND: "E_GMAIL_026", // single message not found OR its thread not visible (404-on-invisible, mailbox privacy)
  // OAUTH
  OAUTH_INVALID_CLIENT: "E_OAUTH_001",
  OAUTH_INVALID_GRANT: "E_OAUTH_002",
  OAUTH_INVALID_PKCE: "E_OAUTH_003",
  OAUTH_CODE_EXPIRED: "E_OAUTH_004",
  OAUTH_TOKEN_REVOKED: "E_OAUTH_005",
  OAUTH_CONSENT_REQUIRED: "E_OAUTH_006",
  // SYNC
  SYNC_CURSOR_EXPIRED: "E_SYNC_001", // History cursor expired (404): gap-recovery resync triggered
  // JOBS
  JOBS_BOSS_MISSING: "E_JOBS_001", // producer ran in production with no pg-boss booted: jobs would be dropped
  // FILE
  FILE_PRESIGN_INVALID: "E_FILE_001", // Presign/confirm input validation failed
  FILE_METADATA_MISMATCH: "E_FILE_002", // Object metadata mismatch on confirm (size/content-type)
  // NOTIF
  NOTIF_UNKNOWN_TYPE: "E_NOTIF_001", // unknown/unsupported notification type
  NOTIF_TARGET_NOT_FOUND: "E_NOTIF_002", // mention/notification target user not found
  NOTIF_PRODUCE_FAILED: "E_NOTIF_003", // createNotification failed unexpectedly (DB/internal)
  // SEARCH
  SEARCH_EMPTY_QUERY: "E_SEARCH_001", // empty/blank search query
  // STATS
  STATS_PIPELINE_NOT_VISIBLE: "E_STATS_001", // requested pipeline not visible to user (restricted or archived)
  STATS_NO_PIPELINE: "E_STATS_002", // RETIRED (STATS-08): null pipelineId now aggregates "All pipelines" instead of erroring. Do not reuse E_STATS_002.
  // GOAL
  GOAL_INVALID: "E_GOAL_001", // goal payload failed the Zod boundary (bad subject/action/metric mix)
  GOAL_NOT_FOUND: "E_GOAL_002", // goal id does not exist or is already deleted
  // ENRICH
  ENRICH_NO_PROVIDER: "E_ENRICH_001", // no enrichment provider is both enabled and credentialled
  ENRICH_PROVIDER_AUTH: "E_ENRICH_002", // provider rejected the API key (401/403)
  ENRICH_THROTTLED: "E_ENRICH_003", // every enabled provider is rate limited or out of credits
  ENRICH_NO_IDENTIFIER: "E_ENRICH_004", // record carries nothing usable to look the subject up by
  ENRICH_RUN_NOT_FOUND: "E_ENRICH_005", // apply targeted a run that is missing or outside the TTL
  ENRICH_STALE: "E_ENRICH_006", // record changed since the run was produced (compare-and-swap)
  ENRICH_INPUT_INVALID: "E_ENRICH_007", // action input failed the Zod boundary
  ENRICH_MAPPING_INVALID: "E_ENRICH_008", // mapping target type incompatible with the canonical key
  ENRICH_ALL_FAILED: "E_ENRICH_009", // every attempted provider failed; context names each reason
  ENRICH_NO_KEY: "E_ENRICH_010", // tried to enable a provider that has no API key stored
  ENRICH_UNSUPPORTED: "E_ENRICH_011", // no provider can search by the identifiers this record has
  ENRICH_MAPPINGS_CHANGED: "E_ENRICH_012", // field mapping was repointed while the review was open
  ENRICH_KEY_UNREADABLE: "E_ENRICH_013", // stored API key could not be decrypted; admin must re-enter it
  ENRICH_NOT_ENTITLED: "E_ENRICH_014", // provider plans do not include the endpoint this lookup needs
  ENRICH_NO_SEARCH_PROVIDER: "E_ENRICH_015", // no enabled provider can search a company for people
  ENRICH_ORG_NO_DOMAIN: "E_ENRICH_016", // the organization carries no domain to search people by
  ENRICH_BATCH_NOT_FOUND: "E_ENRICH_017", // reveal batch is missing or belongs to another organization
  ENRICH_SELECTION_TOO_LARGE: "E_ENRICH_018", // more profiles selected than one reveal batch allows
  ENRICH_REVEAL_INCOMPLETE: "E_ENRICH_019",
  ENRICH_APPLIED_PERSON_GONE: "E_ENRICH_020",
  ENRICH_PROSPECT_MISMATCH: "E_ENRICH_021",

  // AI
  AI_UNAVAILABLE: "E_AI_001", // no provider: OPENROUTER_API_KEY empty and AI_FAKE off
  AI_DISABLED: "E_AI_002", // ai_settings.enabled = false
  AI_COMPANY_LIMIT: "E_AI_003", // company monthly token cap reached
  AI_USER_LIMIT: "E_AI_004", // per-user monthly token cap reached
  AI_BAD_OUTPUT: "E_AI_005", // model reply failed JSON/schema twice
  AI_PROVIDER_FAILED: "E_AI_006", // provider call failed (network, 4xx/5xx)
  AI_INPUT_INVALID: "E_AI_007", // AI action input failed Zod validation or unsupported target
  AI_CONVERSATION_NOT_FOUND: "E_AI_008", // conversation missing or owned by another user
  AI_ACTION_NOT_FOUND: "E_AI_009", // pending action missing, decided, or owned by another user
  AI_TOOL_FAILED: "E_AI_010", // confirmed write tool returned an error
  AI_RATE_LIMITED: "E_AI_011", // more than 20 AI requests per minute for this user

  // MAIL (system mail)
  MAIL_SEND_FAILED: "E_MAIL_001", // SMTP send rejected or failed
  MAIL_CAPTURE_FAILED: "E_MAIL_002", // capture mailer could not write its file
  MAIL_CONNECT_FAILED: "E_MAIL_003", // IMAP/SMTP server unreachable, TLS failure or timeout
  MAIL_AUTH_FAILED: "E_MAIL_004", // IMAP or SMTP rejected the username/password
  MAIL_INBOX_MISSING: "E_MAIL_005", // mailbox has no INBOX after login
  MAIL_ADDRESS_TAKEN: "E_MAIL_006", // that address is already connected by another user
  MAIL_CREDENTIALS_UNREADABLE: "E_MAIL_007", // stored password could not be decrypted; reconnect
  MAIL_IMAP_FAILED: "E_MAIL_008", // an IMAP command failed after login (context names the command)
  MAIL_SEND_DEFERRED: "E_MAIL_009", // daily recipient limit reached; attempt rescheduled
  MAIL_TOO_MANY_RECIPIENTS: "E_MAIL_010", // more recipients than MAIL_SEND_MAX_RECIPIENTS
  MAIL_MESSAGE_TOO_LARGE: "E_MAIL_011", // message larger than MAIL_MAX_MESSAGE_BYTES (attachment)
  MAIL_APPEND_FAILED: "E_MAIL_012", // APPEND to Sent failed; queued for retry
  MAIL_LOCATION_MISSING: "E_MAIL_013", // no known folder/UID for a message (attachment, trash)
  MAIL_INPUT_INVALID: "E_MAIL_014", // connect form or mail action input failed Zod validation
  MAIL_UNSUPPORTED: "E_MAIL_015", // operation not supported by this provider

  // PRODUCT
  PRODUCT_NOT_FOUND: "E_PRODUCT_001", // product not found or not visible
  PRODUCT_IN_USE: "E_PRODUCT_002", // delete refused: product used on a deal (archive instead)
  PRODUCT_CODE_TAKEN: "E_PRODUCT_003", // product code already used by another product
  PRODUCT_VALUE_CALCULATED: "E_PRODUCT_004", // manual value edit on a deal with product lines
  PRODUCT_LINE_NOT_FOUND: "E_PRODUCT_005", // deal line not found
  PRODUCT_INPUT_INVALID: "E_PRODUCT_006", // product, deal-line or deal-terms input failed Zod validation
  // CURRENCY
  CURRENCY_RATE_MISSING: "E_CURRENCY_001", // no exchange rate for a needed currency
  CURRENCY_UNKNOWN: "E_CURRENCY_002", // unknown currency code
  CURRENCY_BASE_RATE: "E_CURRENCY_003", // a rate was submitted for the base currency
  CURRENCY_CHANGE_WITH_LINES: "E_CURRENCY_004", // currency change on a deal with product lines
  CURRENCY_PARSE_FAILED: "E_CURRENCY_005", // a pre-validated money string failed the pure parser (programmer error)
  CURRENCY_INPUT_INVALID: "E_CURRENCY_006", // currency settings input failed Zod validation

  // DOCUMENT (quotes and invoices)
  DOC_NOT_FOUND: "E_DOC_001", // document not found or not visible
  DOC_IMMUTABLE: "E_DOC_002", // edit of an issued document
  DOC_TRANSITION: "E_DOC_003", // transition not allowed from the current status
  DOC_EXPIRED: "E_DOC_004", // accept or decline after valid_until
  DOC_NO_CUSTOMER_EMAIL: "E_DOC_005", // send with no customer email
  DOC_NO_MAILBOX: "E_DOC_006", // send without a connected mailbox
  DOC_OVERPAYMENT: "E_DOC_007", // payment above the outstanding amount
  DOC_INVOICE_DELETE: "E_DOC_008", // delete of an issued invoice
  DOC_TEMPLATE_NOT_FOUND: "E_DOC_009", // template not found
  DOC_RATE_LIMITED: "E_DOC_010", // public request rate-limited
  DOC_INPUT_INVALID: "E_DOC_011", // document, template or settings input failed Zod validation
  DOC_LAST_TEMPLATE: "E_DOC_012", // delete refused: a kind must keep one template

  // AUTOMATION (automations and their run log)
  AUTOMATION_NOT_FOUND: "E_AUTOMATION_001", // automation not found
  AUTOMATION_DEFINITION_INVALID: "E_AUTOMATION_002", // definition failed validation (context: issues)
  AUTOMATION_ACTION_FAILED: "E_AUTOMATION_003", // action failed (context: index, type, cause id)
  AUTOMATION_DRAFT_INVALID: "E_AUTOMATION_004", // AI draft could not be turned into a valid definition
  AUTOMATION_EMAIL_SKIPPED: "E_AUTOMATION_005", // email action skipped by cooldown or missing recipient
  AUTOMATION_INPUT_INVALID: "E_AUTOMATION_006", // action input failed Zod

  // WEBHOOK (outgoing webhooks)
  WEBHOOK_NOT_FOUND: "E_WEBHOOK_001", // subscription not found
  WEBHOOK_URL_REFUSED: "E_WEBHOOK_002", // URL refused (scheme, credentials, or private target)
  WEBHOOK_DELIVERY_FAILED: "E_WEBHOOK_003", // delivery failed (context: status code or network cause)
  WEBHOOK_DISABLED: "E_WEBHOOK_004", // subscription disabled
  WEBHOOK_INPUT_INVALID: "E_WEBHOOK_005", // action input failed Zod

  // FORM (public web forms)
  FORM_NOT_FOUND: "E_FORM_001", // form missing, inactive, or owner inactive
  FORM_DEFINITION_INVALID: "E_FORM_002", // invalid form definition (context: issues)
  FORM_SUBMISSION_INVALID: "E_FORM_003", // submission failed validation (context: fieldErrors)
  FORM_RATE_LIMITED: "E_FORM_004", // public submission rate-limited
  FORM_INPUT_INVALID: "E_FORM_005", // action input failed Zod

  // BOOKING (public booking pages)
  BOOKING_NOT_FOUND: "E_BOOKING_001", // page missing, inactive, or host inactive
  BOOKING_SLOT_TAKEN: "E_BOOKING_002", // slot no longer free
  BOOKING_INVALID: "E_BOOKING_003", // invalid availability or page settings (context: issues)
  BOOKING_RATE_LIMITED: "E_BOOKING_004", // public booking rate-limited
  BOOKING_CANCEL_INVALID: "E_BOOKING_005", // cancel link invalid or already used
  BOOKING_INPUT_INVALID: "E_BOOKING_006", // action input failed Zod

  // INSIGHT (reports, dashboards, CSV, explain and bulk scoring)
  INSIGHT_NOT_FOUND: "E_INSIGHT_001", // report or dashboard missing, or not readable by the actor
  INSIGHT_DEFINITION_INVALID: "E_INSIGHT_002", // invalid report definition (context: issues)
  INSIGHT_QUERY_TIMEOUT: "E_INSIGHT_003", // one report query exceeded REPORT_QUERY_TIMEOUT_MS
  INSIGHT_EXPLAIN_UNAVAILABLE: "E_INSIGHT_004", // AI insight failed (context: cause id)
  INSIGHT_FORBIDDEN: "E_INSIGHT_005", // edit or delete by someone other than the owner or an admin
  INSIGHT_INPUT_INVALID: "E_INSIGHT_006", // action input failed Zod

  // UI
  UI_CHART_CONTEXT_MISSING: "E_UI_001", // a chart part rendered outside its ChartContainer
  UI_STALE_BUILD: "E_UI_002", // server action posted from a page loaded before the running deploy
  UI_ACTION_UNCONFIRMED: "E_UI_003", // action rejected without returning a Result: answer was lost
} as const;

export type ErrorId = (typeof ERROR_IDS)[keyof typeof ERROR_IDS];

// The ONLY error thrown in app code. Operational failures are Result values, not throws.
export class AppError extends Error {
  readonly id: ErrorId;
  readonly context?: Record<string, unknown>;

  constructor(id: ErrorId, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.id = id;
    this.context = context;
  }
}
