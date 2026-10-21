# Webhooks

A webhook subscription receives every enabled event type as a signed JSON POST. Admins manage
subscriptions under Settings > Webhooks; the delivery log shows the last 100 attempts per
subscription, with redeliver.

## Events

Any of the domain event types listed in [AUTOMATIONS.md](./AUTOMATIONS.md#events), plus the
synthetic `ping` used by "Send test".

## Payload

```json
{
  "id": "evt_1234",
  "type": "deal.won",
  "occurredAt": "2026-10-21T09:00:00.000Z",
  "actorId": "3f1f1655-7a48-45f7-a306-e8839d0df740",
  "changes": [{ "field": "status", "old": "open", "new": "won" }],
  "data": {
    "id": "0e0efd40-7c37-4870-96fe-f2246be246de",
    "title": "Big deal",
    "value": "100.00",
    "currency": "USD",
    "status": "won",
    "stage": { "id": "...", "name": "Won" },
    "pipeline": { "id": "...", "name": "Sales" },
    "owner": { "id": "...", "name": "Ada", "email": "ada@example.com" },
    "person": { "id": "...", "name": "Grace", "email": "grace@example.com" },
    "organization": { "id": "...", "name": "Acme" },
    "expectedCloseDate": "2026-11-01",
    "createdAt": "2026-10-01T09:00:00.000Z",
    "updatedAt": "2026-10-21T09:00:00.000Z"
  }
}
```

The snapshot is built when the dispatcher runs, so `data` is the record's state at delivery time,
not at the moment of the change. A deleted record gives `data: { "id": ... }`. Documents add
`publicUrl`; payloads never contain tokens, secrets, password hashes or private notes.

## Headers

- `content-type: application/json`
- `user-agent: Dealflow-Webhooks/1`
- `x-dealflow-event`: the event type
- `x-dealflow-delivery`: the delivery id
- `x-dealflow-signature`: `t=<unix seconds>,v1=<hex HMAC-SHA256>`

## Verifying a signature

The MAC covers `${timestamp}.${body}`. Reject timestamps older than five minutes.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(secret, header, body, now = Math.floor(Date.now() / 1000)) {
  const parts = header.split(",").map((p) => p.trim());
  const t = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  const given = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!Number.isInteger(t) || given === undefined || Math.abs(now - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
```

## Retries and auto-disable

A 2xx counts as delivered and resets the failure count. A 410 disables the subscription immediately.
Any other result (including a 3xx, which is never followed) retries after 60 s, 5 min, 30 min, 2 h
and 6 h; a sixth failed attempt marks the delivery failed. Ten consecutive failed deliveries disable
the subscription and email its creator. Enabling it again resets the counters.

## Address safety

Delivery resolves the hostname inside the DNS lookup and refuses the request when any resolved
address is blocked, so there is no check-then-connect gap. Blocked ranges:

- IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`,
  `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`,
  `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`.
- IPv6: `::/128`, `::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, plus
  `::ffff:0:0/96` and `64:ff9b::/96`, which are judged by the embedded IPv4 address.

`WEBHOOK_ALLOW_PRIVATE=true` removes the block and allows plain `http`, which is only for local
receivers and the e2e suite. The secret is stored encrypted and returned in plaintext exactly once,
on create or rotate; use "Rotate secret" if it is lost.
