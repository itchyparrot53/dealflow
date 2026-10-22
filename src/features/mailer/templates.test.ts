import { describe, expect, it } from "vitest";
import { inviteMail, magicLinkMail } from "./templates";

describe("magicLinkMail", () => {
  const url = "https://app.example.com/login/magic?token=abc&next=%2Fpipeline";

  it("carries the URL in the text and in the HTML link", () => {
    const mail = magicLinkMail({ url });
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("token=abc&amp;next=%2Fpipeline");
    expect(mail.html).toContain("<a href=");
  });

  it("uses the documented subject", () => {
    expect(magicLinkMail({ url }).subject).toBe("Your Dealflow sign-in link");
  });

  it("carries the branded header in HTML and the text fallback", () => {
    const mail = magicLinkMail({ url });
    expect(mail.html).toContain('src="https://app.example.com/brand/email-logo@2x.png"');
    expect(mail.html).toContain('width="160"');
    expect(mail.html).toContain('alt="Dealflow"');
    expect(mail.text.startsWith("Dealflow\n\n")).toBe(true);
  });

  it("escapes a hostile URL in HTML and leaves the text readable", () => {
    const hostile = 'https://x.test/?a=<script>alert("x")</script>&b=1';
    const mail = magicLinkMail({ url: hostile });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&amp;b=1");
    expect(mail.text).toContain(hostile);
  });
});

describe("inviteMail", () => {
  it("names the inviter and carries the link", () => {
    const url = "https://app.example.com/login/invite?token=t";
    const mail = inviteMail({ url, inviterName: "Dana" });
    expect(mail.subject).toBe("Dana invited you to Dealflow");
    expect(mail.text).toContain(url);
    expect(mail.html).toContain("/login/invite?token=t");
  });

  it("carries the branded header in HTML and the text fallback", () => {
    const mail = inviteMail({
      url: "https://app.example.com/login/invite?token=t",
      inviterName: "Dana",
    });
    expect(mail.html).toContain('src="https://app.example.com/brand/email-logo@2x.png"');
    expect(mail.html).toContain('width="160"');
    expect(mail.html).toContain('alt="Dealflow"');
    expect(mail.text.startsWith("Dealflow\n\n")).toBe(true);
  });
});
