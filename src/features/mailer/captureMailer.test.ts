import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ERROR_IDS } from "@/constants/errorIds";
import { captureMailer } from "./captureMailer";

const MAIL = { to: "person@example.com", subject: "Hello", text: "body", html: "<p>body</p>" };
const signal = (): AbortSignal => AbortSignal.timeout(5_000);

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dealflow-mail-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("captureMailer", () => {
  it("writes one JSON file with the message and a send time", async () => {
    const result = await captureMailer(dir).send(MAIL, signal());
    expect(result.ok).toBe(true);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    const saved = JSON.parse(readFileSync(join(dir, files[0]!), "utf8")) as Record<string, unknown>;
    expect(saved.to).toBe(MAIL.to);
    expect(saved.subject).toBe(MAIL.subject);
    expect(saved.text).toBe(MAIL.text);
    expect(saved.html).toBe(MAIL.html);
    expect(typeof saved.sentAt).toBe("string");
  });

  it("returns E_MAIL_002 when the directory cannot be created", async () => {
    const blocker = join(dir, "blocker");
    writeFileSync(blocker, "not a directory");
    const result = await captureMailer(join(blocker, "child")).send(MAIL, signal());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.id).toBe(ERROR_IDS.MAIL_CAPTURE_FAILED);
  });
});
