import { describe, expect, it } from "vitest";
import { normalizeMessageId, syntheticMessageId } from "./messageId";
import { parseRawMessage, parseTooLarge } from "./parseRaw";
import { stripBccHeader } from "./stripBcc";
import { hadReplyPrefix, normalizeSubject } from "./subject";

const PLAIN = [
  "From: Alice <alice@example.com>",
  "To: Me <me@umev.co.uk>",
  "Subject: Hello",
  "Date: Mon, 05 Oct 2026 10:00:00 +0000",
  "Message-ID: <plain-1@example.com>",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hi there.",
].join("\r\n");

const MULTIPART = [
  "From: Bob <bob@example.com>",
  "To: Me <me@umev.co.uk>",
  "Subject: Re: Pricing",
  "Date: Tue, 06 Oct 2026 11:00:00 +0000",
  "Message-ID: <multi-1@example.com>",
  "In-Reply-To: <plain-1@example.com>",
  "References: <root@example.com> <plain-1@example.com>",
  "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b1"',
  "",
  "--b1",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Body text",
  "--b1",
  'Content-Type: application/pdf; name="doc.pdf"',
  'Content-Disposition: attachment; filename="doc.pdf"',
  "Content-Transfer-Encoding: base64",
  "",
  "aGVsbG8=",
  "--b1--",
  "",
].join("\r\n");

const NO_ID = [
  "From: Carol <carol@example.com>",
  "To: Me <me@umev.co.uk>",
  "Subject: No id here",
  "Date: Wed, 07 Oct 2026 12:00:00 +0000",
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Body without an id.",
].join("\r\n");

describe("normalizeMessageId", () => {
  it("lowercases an angle-bracket id", () => {
    expect(normalizeMessageId("<A@B.com>")).toBe("<a@b.com>");
  });

  it("wraps a bare id", () => {
    expect(normalizeMessageId(" a@b.com ")).toBe("<a@b.com>");
  });

  it("takes the first token out of surrounding text", () => {
    expect(normalizeMessageId("x <a@b> y")).toBe("<a@b>");
  });

  it("returns null for empty or missing values", () => {
    expect(normalizeMessageId("")).toBeNull();
    expect(normalizeMessageId("   ")).toBeNull();
    expect(normalizeMessageId(null)).toBeNull();
    expect(normalizeMessageId(undefined)).toBeNull();
  });
});

describe("normalizeSubject and hadReplyPrefix", () => {
  it("strips repeated prefixes and collapses whitespace", () => {
    expect(normalizeSubject("Re: RE: Fwd: Hello")).toBe("hello");
  });

  it("strips a localised prefix", () => {
    expect(normalizeSubject("AW: Angebot")).toBe("angebot");
  });

  it("strips a numbered reply prefix", () => {
    expect(normalizeSubject("Re[2]: x")).toBe("x");
  });

  it("leaves a plain subject alone and reports no prefix", () => {
    expect(normalizeSubject("Hello")).toBe("hello");
    expect(hadReplyPrefix("Hello")).toBe(false);
    expect(hadReplyPrefix("Re: Hello")).toBe(true);
    expect(normalizeSubject(null)).toBe("");
  });
});

describe("stripBccHeader", () => {
  it("removes a folded Bcc header from the header block only", () => {
    const raw = [
      "From: a@example.com",
      "To: b@example.com",
      "Bcc: one@example.com,",
      " two@example.com",
      "Subject: Hello",
      "",
      "Bcc: in body",
    ].join("\r\n");
    const out = stripBccHeader(raw);
    const [headerBlock, body] = out.split("\r\n\r\n");
    expect(headerBlock).not.toContain("Bcc:");
    expect(headerBlock).toContain("Subject: Hello");
    expect(body).toBe("Bcc: in body");
  });

  it("leaves a message without Bcc untouched", () => {
    expect(stripBccHeader(PLAIN)).toBe(PLAIN);
  });
});

describe("parseRawMessage", () => {
  it("parses a plain message and its direction", async () => {
    const parsed = await parseRawMessage(Buffer.from(PLAIN), {
      ownAddress: "me@umev.co.uk",
    });
    expect(parsed.providerMessageId).toBe("<plain-1@example.com>");
    expect(parsed.rfc822MessageId).toBe("<plain-1@example.com>");
    expect(parsed.fromEmail).toBe("alice@example.com");
    expect(parsed.fromName).toBe("Alice");
    expect(parsed.toEmails).toEqual(["me@umev.co.uk"]);
    expect(parsed.subject).toBe("Hello");
    expect(parsed.snippet).toBe("Hi there.");
    expect(parsed.direction).toBe("inbound");
    expect(parsed.references).toEqual([]);
    expect(parsed.sentAt?.toISOString()).toBe("2026-10-05T10:00:00.000Z");
  });

  it("marks a message from our own address as outbound", async () => {
    const parsed = await parseRawMessage(Buffer.from(PLAIN), {
      ownAddress: "ALICE@example.com",
    });
    expect(parsed.direction).toBe("outbound");
  });

  it("keeps references in order and indexes attachments", async () => {
    const parsed = await parseRawMessage(Buffer.from(MULTIPART), {
      ownAddress: "me@umev.co.uk",
    });
    expect(parsed.inReplyTo).toBe("<plain-1@example.com>");
    expect(parsed.references).toEqual(["<root@example.com>", "<plain-1@example.com>"]);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({
      providerAttachmentId: "idx:0",
      filename: "doc.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5,
    });
    expect(parsed.bodyText).toContain("Body text");
  });

  it("synthesises an id when the message has none", async () => {
    const parsed = await parseRawMessage(Buffer.from(NO_ID), {
      ownAddress: "me@umev.co.uk",
    });
    expect(parsed.providerMessageId).toMatch(/^<synthetic-[0-9a-f]{32}@dealflow\.invalid>$/);
    expect(parsed.rfc822MessageId).toBe(parsed.providerMessageId);
    expect(syntheticMessageId({ from: "a", date: "b", subject: "c", size: 1 })).toBe(
      syntheticMessageId({ from: "a", date: "b", subject: "c", size: 1 }),
    );
  });

  it("normalises a bare In-Reply-To and dedupes references", async () => {
    const raw = PLAIN.replace(
      "Message-ID: <plain-1@example.com>",
      [
        "Message-ID: <plain-1@example.com>",
        "In-Reply-To: parent@example.com",
        "References: <p@example.com> <p@example.com> <q@example.com>",
      ].join("\r\n"),
    );
    const parsed = await parseRawMessage(Buffer.from(raw), { ownAddress: "me@umev.co.uk" });
    expect(parsed.inReplyTo).toBe("<parent@example.com>");
    expect(parsed.references).toEqual(["<p@example.com>", "<q@example.com>"]);
  });
});

describe("parseTooLarge", () => {
  it("returns the preview body and no attachments", async () => {
    const headers = Buffer.from(
      [
        "From: Bob <bob@example.com>",
        "To: me@umev.co.uk",
        "Subject: Big one",
        "Message-ID: <big@example.com>",
        "",
      ].join("\r\n"),
    );
    const parsed = await parseTooLarge(headers, 20_000_000, { ownAddress: "me@umev.co.uk" });
    expect(parsed.providerMessageId).toBe("<big@example.com>");
    expect(parsed.bodyText).toBe(
      "This message is too large to preview here. Open it in your mail app.",
    );
    expect(parsed.attachments).toEqual([]);
    expect(parsed.subject).toBe("Big one");
  });
});
