// Request headers for the public-route tests. Kept here so no public feature directory spells the
// proxy header itself: the handlers must read the client IP only through clientIp (Part 5), and
// the checklist greps those directories for the raw header to prove it.
export function publicJsonHeaders(ip: string): Record<string, string> {
  return { "content-type": "application/json", "x-forwarded-for": ip };
}
