# Dealflow REST API

Dealflow's REST API lets a script act as one of your users. Every call runs as the token's user through the same services the interface uses, so visibility, permissions, automations and the change log all apply.

Generated from the route registry (`src/features/api/registry.ts`). Run `pnpm api:docs` after changing a route; a unit test fails when this file is stale.

## Authentication

- Send the token as a bearer header: `Authorization: Bearer dfk_...`.
- Tokens are created in Settings > API and shown once. Requests are never authenticated by session cookie, so a browser cookie alone gets a 401.
- The token's user must be active; a deactivated user's tokens stop working.

## Scopes

- `read` can call GET routes.
- `write` can call GET, POST, PATCH and DELETE.
- A read token calling a write route gets 403 E_API_003.

## Pagination

- List routes are ordered by `(updated_at, id)` ascending and return at most `limit` rows (default 50, max 200).
- When more rows exist the response carries `nextCursor`; pass it as `?cursor=...` for the next page.
- `updated_since` takes an ISO 8601 timestamp and returns only rows changed at or after it.

## Rate limits

- Each token is limited to 120 requests per minute.
- A limited call gets 429 with a `Retry-After` header (seconds).

## Errors

Errors are `{ "error": { "id", "message" } }` with an HTTP status derived from the id: not found 404, permission 403, validation 422, conflict 409.

| Id | HTTP |
|---|---|
| E_API_001 | 401 |
| E_API_002 | 401 |
| E_API_003 | 403 |
| E_API_004 | 429 |
| E_API_005 | 404 |
| E_API_006 | 422 |

## Deals

### GET /deals

Scope: `read`. List visible deals, ordered by updated_at then id.

Query: `limit`, `cursor`, `updated_since`, `pipelineId`, `stageId`, `status`, `ownerId`

Example request:

```json
"GET /api/v1/deals?limit=2"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "title": "Big deal",
      "status": "open",
      "value": "1500.00",
      "currency": "USD",
      "pipelineId": "…",
      "stageId": "…",
      "personId": null,
      "organizationId": null,
      "ownerId": "…",
      "expectedCloseDate": "2026-12-01",
      "createdAt": "2026-10-21T10:00:00.000Z",
      "updatedAt": "2026-10-21T10:00:00.000Z"
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIuLi4iLCJpZCI6Ii4uLiJ9"
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/deals" \
  -H "Authorization: Bearer dfk_..."
```

### GET /deals/:id

Scope: `read`. Read one visible deal.

Example request:

```json
"GET /api/v1/deals/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…",
    "title": "Big deal"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/deals/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /deals

Scope: `write`. Create a deal as the token's user.

Body: `title`, `value`, `currency`, `pipelineId`, `stageId`, `personId`, `organizationId`, `ownerId`, `expectedCloseDate`

Example request:

```json
{
  "title": "New deal",
  "value": "1500.00",
  "pipelineId": "…",
  "stageId": "…"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "title": "New deal"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/deals" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"New deal","value":"1500.00","pipelineId":"…","stageId":"…"}'
```

### PATCH /deals/:id

Scope: `write`. Update a deal: plain fields, stage, owner and status go through their services.

Body: `title`, `value`, `currency`, `pipelineId`, `stageId`, `personId`, `organizationId`, `ownerId`, `expectedCloseDate`, `status`, `lostReason`, `lostReasonId`

Example request:

```json
{
  "stageId": "…"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "stageId": "…"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/deals/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"stageId":"…"}'
```

### DELETE /deals/:id

Scope: `write`. Soft-delete a deal (the recycle bin can restore it).

Example request:

```json
"DELETE /api/v1/deals/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/deals/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## People

### GET /persons

Scope: `read`. List visible people, ordered by updated_at then id.

Query: `limit`, `cursor`, `updated_since`, `search`, `organizationId`

Example request:

```json
"GET /api/v1/persons?search=acme"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Pat Person",
      "emails": [],
      "phones": []
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/persons" \
  -H "Authorization: Bearer dfk_..."
```

### GET /persons/:id

Scope: `read`. Read one visible person.

Example request:

```json
"GET /api/v1/persons/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/persons/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /persons

Scope: `write`. Create a person as the token's user.

Body: `name`, `emails`, `phones`, `organizationId`, `ownerId`

Example request:

```json
{
  "name": "Pat Person"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "name": "Pat Person"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/persons" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Pat Person"}'
```

### PATCH /persons/:id

Scope: `write`. Update a visible person (contact.edit enforced by the service).

Body: `name`, `emails`, `phones`, `organizationId`, `ownerId`

Example request:

```json
{
  "name": "Pat P."
}
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/persons/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Pat P."}'
```

### DELETE /persons/:id

Scope: `write`. Soft-delete a person (visible in the recycle bin for 30 days).

Example request:

```json
"DELETE /api/v1/persons/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/persons/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## Organizations

### GET /organizations

Scope: `read`. List visible organizations, ordered by updated_at then id.

Query: `limit`, `cursor`, `updated_since`, `search`

Example request:

```json
"GET /api/v1/organizations?search=acme"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Acme",
      "address": null
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/organizations" \
  -H "Authorization: Bearer dfk_..."
```

### GET /organizations/:id

Scope: `read`. Read one visible organization.

Example request:

```json
"GET /api/v1/organizations/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/organizations/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /organizations

Scope: `write`. Create an organization as the token's user.

Body: `name`, `address`, `ownerId`

Example request:

```json
{
  "name": "Acme"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "name": "Acme"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/organizations" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme"}'
```

### PATCH /organizations/:id

Scope: `write`. Update a visible organization (contact.edit enforced by the service).

Body: `name`, `address`, `ownerId`

Example request:

```json
{
  "name": "Acme Ltd"
}
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/organizations/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme Ltd"}'
```

### DELETE /organizations/:id

Scope: `write`. Soft-delete an organization (visible in the recycle bin for 30 days).

Example request:

```json
"DELETE /api/v1/organizations/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/organizations/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## Activities

### GET /activities

Scope: `read`. List visible activities, ordered by updated_at then id.

Query: `limit`, `cursor`, `updated_since`, `dealId`, `personId`, `assigneeId`, `done`

Example request:

```json
"GET /api/v1/activities?dealId={dealId}"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "subject": "Call",
      "done": false
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/activities" \
  -H "Authorization: Bearer dfk_..."
```

### GET /activities/:id

Scope: `read`. Read one visible activity.

Example request:

```json
"GET /api/v1/activities/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/activities/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /activities

Scope: `write`. Create an activity as the token's user.

Body: `typeId`, `subject`, `dueAt`, `endAt`, `durationMinutes`, `assigneeId`, `dealId`, `personId`, `organizationId`, `note`, `done`

Example request:

```json
{
  "typeId": "…",
  "subject": "Call",
  "dealId": "…"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "subject": "Call"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/activities" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"typeId":"…","subject":"Call","dealId":"…"}'
```

### PATCH /activities/:id

Scope: `write`. Update an activity; flipping done goes through completeActivity.

Body: `typeId`, `subject`, `dueAt`, `endAt`, `durationMinutes`, `assigneeId`, `dealId`, `personId`, `organizationId`, `note`, `done`

Example request:

```json
{
  "done": true
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "done": true
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/activities/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

### DELETE /activities/:id

Scope: `write`. Soft-delete an activity.

Example request:

```json
"DELETE /api/v1/activities/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/activities/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## Notes

### GET /notes

Scope: `read`. List visible notes, ordered by updated_at then id.

Query: `limit`, `cursor`, `dealId`, `personId`, `organizationId`

Example request:

```json
"GET /api/v1/notes?dealId={dealId}"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "body": "Called back",
      "dealId": "…"
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/notes" \
  -H "Authorization: Bearer dfk_..."
```

### GET /notes/:id

Scope: `read`. Read one visible note.

Example request:

```json
"GET /api/v1/notes/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…",
    "body": "Called back"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/notes/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /notes

Scope: `write`. Add a note to one visible record.

Body: `body`, `dealId`, `personId`, `organizationId`

Example request:

```json
{
  "body": "Called back",
  "dealId": "…"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "body": "Called back"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/notes" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"body":"Called back","dealId":"…"}'
```

### PATCH /notes/:id

Scope: `write`. Edit a note body.

Body: `body`

Example request:

```json
{
  "body": "Edited"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "body": "Edited"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/notes/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"body":"Edited"}'
```

### DELETE /notes/:id

Scope: `write`. Soft-delete a note.

Example request:

```json
"DELETE /api/v1/notes/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/notes/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## Products

### GET /products

Scope: `read`. List products, ordered by updated_at then id.

Query: `limit`, `cursor`, `active`

Example request:

```json
"GET /api/v1/products?active=true"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Seat",
      "price": "10.00",
      "currency": "USD"
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/products" \
  -H "Authorization: Bearer dfk_..."
```

### GET /products/:id

Scope: `read`. Read one product.

Example request:

```json
"GET /api/v1/products/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/products/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /products

Scope: `write`. Create a product (products.manage required).

Body: `name`, `active`, `code`, `unit`, `price`, `currency`, `taxPercent`

Example request:

```json
{
  "name": "Seat",
  "price": "10.00",
  "currency": "USD"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "name": "Seat"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/products" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Seat","price":"10.00","currency":"USD"}'
```

### PATCH /products/:id

Scope: `write`. Update a product (products.manage required).

Body: `name`, `active`, `code`, `unit`, `price`, `currency`, `taxPercent`

Example request:

```json
{
  "price": "12.00"
}
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/products/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"price":"12.00"}'
```

### DELETE /products/:id

Scope: `write`. Archive a product (products.manage required).

Example request:

```json
"DELETE /api/v1/products/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/products/{id}" \
  -H "Authorization: Bearer dfk_..."
```

## Projects

### GET /projects

Scope: `read`. List visible projects, ordered by updated_at then id.

Query: `limit`, `cursor`, `status`, `dealId`

Example request:

```json
"GET /api/v1/projects?status=active"
```

Example response:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Launch",
      "status": "active"
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/projects" \
  -H "Authorization: Bearer dfk_..."
```

### GET /projects/:id

Scope: `read`. Read one visible project with its phases and tasks.

Example request:

```json
"GET /api/v1/projects/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/projects/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### POST /projects

Scope: `write`. Create a project with the default phases unless `phases` is supplied.

Body: `name`, `description`, `dealId`, `organizationId`, `personId`, `ownerId`, `startDate`, `dueDate`, `phases`

Example request:

```json
{
  "name": "Launch"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "name": "Launch"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/projects" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Launch"}'
```

### PATCH /projects/:id

Scope: `write`. Update a project; `status` goes through setProjectStatus.

Body: `name`, `description`, `dealId`, `organizationId`, `personId`, `ownerId`, `startDate`, `dueDate`, `phases`, `status`

Example request:

```json
{
  "status": "completed"
}
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/projects/{id}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}'
```

### DELETE /projects/:id

Scope: `write`. Soft-delete a project (the recycle bin can restore it).

Example request:

```json
"DELETE /api/v1/projects/{id}"
```

Example response:

```json
{
  "data": {
    "id": "…"
  }
}
```

```bash
curl -s -X DELETE "{BASE_URL}/api/v1/projects/{id}" \
  -H "Authorization: Bearer dfk_..."
```

### GET /projects/:id/tasks

Scope: `read`. List a project's tasks.

Example request:

```json
"GET /api/v1/projects/{id}/tasks"
```

Example response:

```json
{
  "data": [
    {
      "id": "…"
    }
  ]
}
```

```bash
curl -s -X GET "{BASE_URL}/api/v1/projects/{id}/tasks" \
  -H "Authorization: Bearer dfk_..."
```

### POST /projects/:id/tasks

Scope: `write`. Add a task to a project.

Body: `title`, `description`, `assigneeId`, `dueDate`, `phaseId`, `position`, `done`

Example request:

```json
{
  "title": "Write the brief",
  "phaseId": "…"
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "title": "Write the brief"
  }
}
```

```bash
curl -s -X POST "{BASE_URL}/api/v1/projects/{id}/tasks" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Write the brief","phaseId":"…"}'
```

### PATCH /projects/:id/tasks/:taskId

Scope: `write`. Update a task; `phaseId` moves it and `done` completes or reopens it.

Body: `title`, `description`, `assigneeId`, `dueDate`, `phaseId`, `position`, `done`

Example request:

```json
{
  "done": true
}
```

Example response:

```json
{
  "data": {
    "id": "…",
    "done": true
  }
}
```

```bash
curl -s -X PATCH "{BASE_URL}/api/v1/projects/{id}/tasks/{taskId}" \
  -H "Authorization: Bearer dfk_..." \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```
