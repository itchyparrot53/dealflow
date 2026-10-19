import { env } from "@/config/env";

export interface AuthMethods {
  password: boolean;
  magicLink: boolean;
  google: boolean;
}

// Single source of truth for which sign-in methods are configured. The login page, the auth routes
// and /auth/start ask this instead of re-deriving the Google all-or-nothing rule.
export function authMethods(): AuthMethods {
  const google =
    env.GOOGLE_OAUTH_CLIENT_ID !== "" &&
    env.GOOGLE_OAUTH_CLIENT_SECRET !== "" &&
    env.GOOGLE_WORKSPACE_DOMAIN !== "";
  return { password: env.AUTH_PASSWORD_ENABLED, magicLink: env.AUTH_MAGIC_LINK_ENABLED, google };
}
