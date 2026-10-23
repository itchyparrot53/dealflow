import { env } from "@/config/env";

// Colour, type and identity tokens for the email layouts (PLAN-PART13 6.2). Emails are light-only
// by design: one palette that renders the same in Gmail, Outlook and Apple Mail.

export const EMAIL_COLORS = {
  text: "#21232C",
  muted: "#65686F",
  border: "#E3E3E3",
  page: "#F4F4F7",
  summary: "#F7F7FB",
  white: "#FFFFFF",
  footerRule: "#EFEFF2",
  dealflowAccent: "#2D8548",
} as const;

export const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const DEALFLOW_LOGO = {
  path: "/brand/email-logo@2x.png",
  width: 160,
  height: 33,
} as const;

export type NewEmailLayout = "branded" | "plain";
export type ReplyLayout = "minimal" | "branded" | "plain";

export interface EmailLogo {
  url: string;
  width: number;
  height: number;
}

export interface EmailDesign {
  displayName: string;
  accentColor: string;
  logo: EmailLogo | null;
  showAddress: boolean;
  addressLines: string[];
  footerText: string | null;
  showPoweredBy: boolean;
  newEmailLayout: NewEmailLayout;
  replyLayout: ReplyLayout;
  footerOnReplies: boolean;
}

// The product family's fixed identity. The display name is the company's, resolved by the caller
// (Settings > Company), so the footer can say who the mail was sent for.
export const DEALFLOW_DESIGN: EmailDesign = {
  displayName: "Dealflow",
  accentColor: EMAIL_COLORS.dealflowAccent,
  logo: {
    url: new URL(DEALFLOW_LOGO.path, env.BASE_URL).toString(),
    width: DEALFLOW_LOGO.width,
    height: DEALFLOW_LOGO.height,
  },
  showAddress: false,
  addressLines: [],
  footerText: null,
  showPoweredBy: false,
  newEmailLayout: "branded",
  replyLayout: "minimal",
  footerOnReplies: false,
};
