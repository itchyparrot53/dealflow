import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/config/env";
import { AppError, ERROR_IDS } from "@/constants/errorIds";
import { err, ok } from "@/types/result";
import type { SystemMailer } from "./types";

// Capture mode: writes each message as JSON under a directory so tests and the e2e stack can read
// exactly what would have been sent. MAIL_FAKE is the switch; the app never sends real mail in this
// mode, which is why it is allowed in a production build.
export function captureMailer(dir: string = env.MAIL_CAPTURE_DIR): SystemMailer {
  return {
    mode: "capture",
    async send(mail, signal) {
      signal.throwIfAborted();
      try {
        await mkdir(dir, { recursive: true });
        const record = { ...mail, sentAt: new Date().toISOString() };
        await writeFile(
          join(dir, `${Date.now()}-${randomUUID()}.json`),
          `${JSON.stringify(record, null, 2)}\n`,
          "utf8",
        );
        signal.throwIfAborted();
        return ok({ messageId: randomUUID() });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        return err(
          new AppError(ERROR_IDS.MAIL_CAPTURE_FAILED, "could not write captured mail", { dir }),
        );
      }
    },
  };
}
