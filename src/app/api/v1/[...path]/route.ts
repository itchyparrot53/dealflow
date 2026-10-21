import type { NextRequest } from "next/server";
import { handleApiRequest } from "@/features/api/handler";

// One catch-all dispatches every /api/v1 route through the registry. There is no per-resource
// route file, so a resource cannot be reachable at a path the docs do not know about.

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  return handleApiRequest(req, "GET", path);
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  return handleApiRequest(req, "POST", path);
}

export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  return handleApiRequest(req, "PATCH", path);
}

export async function DELETE(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const { path } = await ctx.params;
  return handleApiRequest(req, "DELETE", path);
}
