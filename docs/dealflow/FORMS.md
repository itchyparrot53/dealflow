# Forms

A form turns a stranger's submission into a lead or a deal. Admins create them under Settings >
Forms; the public page is `/f/{publicId}` and needs no sign-in. The page and its submit route may be
framed by any site, and every public page carries a "Powered by Dealflow" footer.

## Fields

A form has 1 to 15 fields. `name` and `email` are always present and required; `phone`,
`organization`, `job_title` and `message` are optional additions, and any eligible custom field can
be added as `cf_<definition id>`. Eligible custom fields are the active definitions on person, lead
or deal whose type is text, long text, number, date or single option. Name and email cannot be
removed or made optional in the editor.

A submission trims every value, enforces the required flags, caps a value at 2000 characters, checks
the email format, and validates number, date and single-option custom values. Unknown keys are
dropped. `job_title` is kept in the submission values and the note, because upstream `persons` has
no job-title column.

## What a submission creates

One transaction creates, as the form owner:

- the person, found by email (case-insensitive, `citext`) or created with name, email and phone;
- the organization, found by `lower(name)` or created, and linked when the person had none;
- the lead (title `{name} via {form name}`, source origin and channel `web_form`) or the deal (title
  `{organization or name} via {form name}` in the form's pipeline and stage);
- custom field values on the record that owns each definition;
- the message (plus job title and phone) as a note on the lead or deal;
- the submission row and an incremented submission count;
- a `form.submitted` domain event, and after commit a `form_submission` notification to the owner.

A failed notification never fails the submission. The response is the form's success message plus
the redirect URL when one is set.

## Spam protection

- A hidden `website` honeypot. A filled value is accepted silently and nothing is written.
- A signed `startedAt` token (HMAC-SHA256 with the install's server secret, 24-hour lifetime).
  Submissions under two seconds, with a bad signature, or from the future are accepted silently.
- 10 submissions a minute per client IP and form; over that the route answers 429 with
  `Retry-After`.
- The body is capped at 64 KB and must be JSON or a classic form post.

## Embedding and no JavaScript

The editor shows the exact snippet:

```html
<iframe src="{BASE_URL}/f/{publicId}" width="100%" height="640" style="border:0" title="Contact us"></iframe>
```

The page renders a real HTML form, so it works with JavaScript disabled: the browser posts to
`/api/public/forms/{publicId}/submit`, which answers 303 back to `/f/{publicId}?done=1` and the page
renders the success state. With JavaScript it submits with `fetch` and marks individual fields.

Only `/f/*` and `/book/*` are framed: `next.config.ts` gives them `frame-ancestors *` and omits
`X-Frame-Options`; every other route keeps `frame-ancestors 'none'`.

## Events

`form.submitted` carries the lead or deal as its entity and `changes: [{ field: "form", new: <id> }]`.
Automations can trigger on it with an optional form filter, and webhooks receive it with payload:

```json
{
  "form": { "id": "...", "name": "Contact us" },
  "values": { "name": "Riley Chen", "email": "riley@example.com" },
  "lead": { "id": "...", "title": "Riley Chen via Contact us" },
  "person": { "id": "...", "name": "Riley Chen", "email": "riley@example.com" }
}
```

A condition on this event evaluates against the visitor's person.
