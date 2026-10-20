import { describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { FakeGmailClient } from "@/features/email/gmailFake";
import { ok } from "@/types/result";
import { gmailProviderForTest } from "./gmailAdapter";

const SIG = (): AbortSignal => AbortSignal.timeout(5_000);
// The adapter only touches the database in sync(), which these tests do not call.
const noDb = {} as unknown as Db;

function provider(gmail: FakeGmailClient) {
  return gmailProviderForTest(noDb, "acct-1", gmail);
}

describe("Gmail MailProvider adapter", () => {
  it("send returns the fake's message id and thread id", async () => {
    const gmail = new FakeGmailClient();
    gmail.sendImpl = () => ok({ id: "sent-1", threadId: "thread-9" });
    gmail.messages.set("sent-1", {
      id: "sent-1",
      threadId: "thread-9",
      snippet: "short preview",
      labelIds: [],
    });

    const sent = await provider(gmail).send({
      raw: "From: a@example.com\r\nTo: b@example.com\r\n\r\nhello",
      messageIdHeader: "<dealflow-1@example.com>",
      envelope: { from: "a@example.com", to: ["b@example.com"] },
      providerThreadId: null,
      parentProviderMessageId: null,
      attemptId: "attempt-1",
      signal: SIG(),
    });

    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.providerMessageId).toBe("sent-1");
    expect(sent.value.providerThreadId).toBe("thread-9");
    expect(sent.value.snippet).toBe("short preview");
    expect(sent.value.headers.rfc822MessageId).toBe("<dealflow-1@example.com>");
    const sendCall = gmail.calls.find((call) => call.method === "sendRaw");
    expect(sendCall).toBeDefined();
  });

  it("findSent maps a search hit and a miss", async () => {
    const gmail = new FakeGmailClient();
    gmail.searchHits.set("<hit@example.com>", {
      messages: [{ id: "gmail-77", threadId: "thread-77" }],
      resultSizeEstimate: 1,
    });

    const hit = await provider(gmail).findSent({
      messageIdHeader: "<hit@example.com>",
      signal: SIG(),
    });
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value).toEqual({ providerMessageId: "gmail-77" });

    const miss = await provider(gmail).findSent({
      messageIdHeader: "<missing@example.com>",
      signal: SIG(),
    });
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });

  it("fetchAttachment decodes base64url bytes", async () => {
    class AttachmentFake extends FakeGmailClient {
      override getAttachment(): ReturnType<FakeGmailClient["getAttachment"]> {
        return Promise.resolve(ok({ dataBase64: Buffer.from("hello mail").toString("base64url") }));
      }
    }
    const bytes = await provider(new AttachmentFake()).fetchAttachment({
      providerMessageId: "m1",
      providerAttachmentId: "idx:0",
      signal: SIG(),
    });
    expect(bytes.ok).toBe(true);
    if (bytes.ok) expect(bytes.value.bytes.toString("utf8")).toBe("hello mail");
  });

  it("replyHeaders builds inReplyTo and references from the parent message", async () => {
    const gmail = new FakeGmailClient();
    gmail.messages.set("parent-1", {
      id: "parent-1",
      threadId: "thread-1",
      labelIds: [],
      payload: {
        headers: [
          { name: "Message-ID", value: "<parent@example.com>" },
          { name: "References", value: "<root@example.com>" },
        ],
      },
    });

    const headers = await provider(gmail).replyHeaders({
      parentProviderMessageId: "parent-1",
      signal: SIG(),
    });
    expect(headers.inReplyTo).toBe("<parent@example.com>");
    expect(headers.references).toBe("<root@example.com> <parent@example.com>");

    const missing = await provider(gmail).replyHeaders({
      parentProviderMessageId: "unknown",
      signal: SIG(),
    });
    expect(missing).toEqual({});
  });
});
