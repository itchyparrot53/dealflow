import { emailBrandHeaderHtml, emailBrandHeaderText } from "./branding";
import type { MailContent } from "./types";

// System-mail copy. Plain text is the source of truth; the HTML part is the same wording with the
// link as an anchor. Every interpolated value is escaped, because the URL carries a token and the
// inviter name is user data.

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[character] ?? character;
  });
}

function linkParagraph(url: string): string {
  const safe = escapeHtml(url);
  return `<p><a href="${safe}">${safe}</a></p>`;
}

export function magicLinkMail({ url }: { url: string }): MailContent {
  return {
    subject: "Your Dealflow sign-in link",
    text: `${emailBrandHeaderText()}Sign in to Dealflow with this link. It expires in 15 minutes and works once.\n\n${url}\n\nIf you didn't ask for it, ignore this email.`,
    html: [
      emailBrandHeaderHtml(),
      "<p>Sign in to Dealflow with this link. It expires in 15 minutes and works once.</p>",
      linkParagraph(url),
      "<p>If you didn't ask for it, ignore this email.</p>",
    ].join(""),
  };
}

export function inviteMail({
  url,
  inviterName,
}: {
  url: string;
  inviterName: string;
}): MailContent {
  return {
    subject: `${inviterName} invited you to Dealflow`,
    text: `${emailBrandHeaderText()}Set your password and sign in with this link. It expires in 7 days.\n\n${url}`,
    html: [
      emailBrandHeaderHtml(),
      "<p>Set your password and sign in with this link. It expires in 7 days.</p>",
      linkParagraph(url),
    ].join(""),
  };
}
