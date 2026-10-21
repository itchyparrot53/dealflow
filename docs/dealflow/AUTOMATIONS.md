# Automations

An automation runs an ordered list of actions when a domain event happens. Admins create them
under Settings > Automations; they are stored in `automations` and every run is recorded in
`automation_runs`.

## Events

Changes write one row into `domain_events` inside the mutation's own transaction, so a rolled-back
change leaves no event. `recordChange` covers every audited edit; creates and document status changes
emit explicitly. The dispatcher claims the outbox with `FOR UPDATE SKIP LOCKED`, coalesces one
transaction's edits to the same record into one `*.updated` event, and fans out to automations and
webhooks.

Event types: `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.won`, `deal.lost`,
`deal.deleted`, `deal.rotting`, `person.created`, `person.updated`, `organization.created`,
`organization.updated`, `activity.created`, `activity.completed`, `document.sent`,
`document.viewed`, `document.accepted`, `document.declined`, `invoice.overdue`, `invoice.paid`,
`invoice.voided`.

## Triggers

A trigger is one event type plus optional filters: `pipelineId` on deal triggers, `stageId` (the
stage entered) on `deal.stage_changed`, `fields` on `deal.updated`, and `kind` (`quote` or
`invoice`) on document and invoice triggers. `activity.completed` fires when an activity turns done.

## Conditions

A condition is a saved-filter definition evaluated against the record's current state. Deal events
(including activity and document events) evaluate on the related deal; a record with no deal skips
as `condition_false`. `person.created` and `organization.created` evaluate on the contact.

## Actions

`update_deal`, `create_activity`, `add_note`, `notify_user`, `send_email`, `ai_summarize_deal`,
`ai_score_deal`, `ai_draft_email`. Actions call the same services the UI calls, so permissions,
change logs, realtime events and board updates behave as for a user edit. At most 10 actions run in
order; the first failure stops the run and records its error id.

`{{deal.title}}`, `{{deal.value}}`, `{{person.name}}`, `{{person.first_name}}`,
`{{organization.name}}`, `{{owner.name}}` and `{{owner.email}}` render in text fields.

`send_email` sends a saved email template through the creator's connected mailbox to the deal's
primary person, at most once per person per 24 hours for that automation; without a person, an
address or a mailbox it is skipped with `E_AUTOMATION_005`.

## Loop guard

The event chain id travels in an `AsyncLocalStorage` context set by the runner. A unique index on
`(automation_id, chain_id, entity_id)` means an automation runs at most once per record per chain,
and dispatches deeper than `AUTOMATION_MAX_DEPTH` (3) are recorded as skipped with `depth_limit`.
Two automations that keep moving the same deal therefore stop after one round.

## AI actions

AI actions call the Part 1 AI layer as the creator, so the provider, company and user caps, the rate
limit and usage recording all apply. `ai_summarize_deal` writes the summary, risks and next steps as
a note; `ai_score_deal` stores the score; `ai_draft_email` saves a draft for the creator and never
sends it.

## Describe it

"Describe it" sends the sentence plus the install's real pipeline, stage, activity-type, template and
user ids to the AI, parses the answer with `automationDefinitionSchema`, and relies on one repair
round that sends the validation issues back. A second failure is `E_AUTOMATION_004`. The draft opens
in the editor disabled, with "Review before saving".

## Templates

Six built-in templates build their definitions from the first pipeline, its stages and the first
activity type: onboarding call on win, quote accepted notification, chase overdue invoices, advance
a stage when a quote is sent, summarize big deals at the last stage, and a welcome notification for
new organizations.

## Run log and retention

The editor's Run log shows the last 100 runs with status, skip reason and per-action steps.
Retention deletes processed events after 30 days and finished runs after 90 days; the dispatcher
polls every 5 seconds and also wakes on `LISTEN dealflow_domain_events`.
