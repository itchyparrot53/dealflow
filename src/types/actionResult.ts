import type { AppError } from "@/constants/errorIds";
import type { Result } from "./result";

export interface ClientError {
  id: string;
  // Optional machine-readable detail (e.g. the missing currency code) so a form can
  // show the exact copy without the server message. Never a human-readable message.
  code?: string;
  message?: never;
}

export type ActionResult<Ok> = Result<Ok, ClientError>;

export function clientErr(error: AppError): { ok: false; error: ClientError } {
  const code = error.context?.code;
  return {
    ok: false,
    error: typeof code === "string" ? { id: error.id, code } : { id: error.id },
  };
}

export function toClientResult<Ok>(result: Result<Ok, AppError>): ActionResult<Ok> {
  return result.ok ? result : clientErr(result.error);
}
