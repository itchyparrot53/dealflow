import type { z } from "zod";
import type { AppError } from "@/constants/errorIds";
import type { Db } from "@/db/client";
import type { PermSetUser } from "@/features/permissions/effective";
import type { Result } from "@/types/result";

// The API contract's building blocks: one registry entry per route, and the context a handler
// receives. The registry is the single source for routing, Zod validation and both docs pages.

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiCtx {
  db: Db;
  actor: PermSetUser;
  tokenId: string;
}

export interface ApiPayload {
  data: unknown;
  nextCursor?: string;
}

export type ApiHandler = (
  ctx: ApiCtx,
  params: Record<string, string>,
  query: unknown,
  body: unknown,
  signal: AbortSignal,
) => Promise<Result<ApiPayload, AppError>>;

export interface ApiExample {
  request?: unknown;
  response: unknown;
}

export interface ApiRoute {
  resource: string;
  method: ApiMethod;
  path: string;
  scope: "read" | "write";
  summary: string;
  query?: z.ZodType;
  body?: z.ZodType;
  handler: ApiHandler;
  example: ApiExample;
}

export function payload(data: unknown, nextCursor?: string): ApiPayload {
  return nextCursor === undefined ? { data } : { data, nextCursor };
}
