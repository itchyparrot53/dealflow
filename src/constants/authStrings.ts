// UI copy for the local sign-in surfaces (login, magic-link confirm, invite accept). Kept together
// so the error-code mapping in the routes and the pages cannot drift apart.
export const AUTH_STRINGS = {
  signInTitle: "Sign in to Dealflow",
  signInAs: (email: string) => `Sign in as ${email}`,
  setPasswordTitle: "Set your password",
  tabPassword: "Password",
  tabLink: "Email link",
  emailLabel: "Email",
  passwordLabel: "Password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm password",
  nameLabel: "Name",
  signIn: "Sign in",
  emailMeLink: "Email me a sign-in link",
  forgotPassword:
    "Forgot your password? Use the Email link tab, then set a new password in Settings → Profile.",
  continue: "Continue",
  setPasswordAndSignIn: "Set password and sign in",
  orDivider: "or",
  google: "Sign in with Google",
  sentNotice:
    "Check your email. If an account exists for that address, a sign-in link is on its way. It expires in 15 minutes.",
  expired: "This link has expired or was already used.",
  backToSignIn: "Back to sign in",
  // Error codes arrive as ?error=<code> from the route handlers.
  errors: {
    invalid_credentials:
      "That email and password don't match, or the account is locked for 15 minutes after too many attempts. You can also sign in with an email link.",
    rate_limited: "Too many attempts. Wait a few minutes and try again.",
    link_expired: "That link has expired or was already used. Request a new one.",
    auth_failed: "Google sign-in failed. Try again or use another method.",
  } as Record<string, string>,
  inviteErrors: {
    name_missing: "Enter your name.",
    password_short: "Use 12 to 128 characters.",
    password_mismatch: "The passwords don't match.",
  } as Record<string, string>,
} as const;
