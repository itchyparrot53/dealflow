export const LOGIN_RETURN_COOKIE = "wd_login_return";

const DEFAULT_RETURN_PATH = "/";
const MAX_RETURN_PATH_LENGTH = 4_096;

export function safeLoginReturnPath(raw: string | null | undefined): string {
  if (
    raw === null ||
    raw === undefined ||
    raw.length === 0 ||
    raw.length > MAX_RETURN_PATH_LENGTH ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\")
  ) {
    return DEFAULT_RETURN_PATH;
  }

  const parsed = new URL(raw, "https://warpdrive.invalid");
  return `${parsed.pathname}${parsed.search}`;
}

// Local sign-in (password and magic link) lands on the pipeline by default; the Google flow keeps
// its historical "/" default. Both still pass through the same sanitiser.
export const DEFAULT_LOGIN_PATH = "/pipeline";

export function loginReturnTarget(raw: string | null | undefined): string {
  const path = safeLoginReturnPath(raw);
  return path === DEFAULT_RETURN_PATH ? DEFAULT_LOGIN_PATH : path;
}
