// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_TEMPLATES } from "../registry";
import { defaultTemplate } from "../templates";
import { TemplateEditor } from "./TemplateEditor";

const { saveTemplateAction, resetTemplateAction, testAction } = vi.hoisted(() => ({
  saveTemplateAction: vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      value: { subject: "Saved", preheader: null, bodyHtml: "<p>x</p>", ctaLabel: null },
    }),
  ),
  resetTemplateAction: vi.fn(() =>
    Promise.resolve({
      ok: true as const,
      value: { subject: "Default", preheader: null, bodyHtml: "<p>d</p>", ctaLabel: null },
    }),
  ),
  testAction: vi.fn(() => Promise.resolve({ ok: true as const, value: { messageId: "m" } })),
}));

vi.mock("../actions", () => ({
  saveEmailTemplateAction: saveTemplateAction,
  resetEmailTemplateAction: resetTemplateAction,
  sendEmailTemplateTestAction: testAction,
}));
vi.mock("@/utils/csrfCookie", () => ({ readCsrfToken: () => "csrf" }));
vi.mock("@/lib/trpc-client", () => ({
  trpc: {
    emailDesign: {
      previewTemplate: { useQuery: () => ({ data: { html: "<p>preview</p>", subject: "s" } }) },
    },
  },
}));
vi.mock("@/features/feedback/toastStore", () => ({ useToastStore: () => () => undefined }));
vi.mock("@/features/email/composer/RichTextBody", () => ({
  RichTextBody: () => <div data-testid="rich-body" />,
}));

afterEach(() => {
  cleanup();
  saveTemplateAction.mockClear();
  resetTemplateAction.mockClear();
  testAction.mockClear();
});

const def = EMAIL_TEMPLATES.sign_in_link;
const initial = defaultTemplate("sign_in_link");

describe("TemplateEditor", () => {
  it("starts from the resolved template and inserts a variable at the subject cursor", async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        def={def}
        initial={initial}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    const subject = screen.getByDisplayValue(initial.subject);
    await user.click(subject);
    await user.click(screen.getByRole("button", { name: "{{link.url}}" }));
    expect(subject).toHaveValue(`Your Dealflow sign-in link{{link.url}}`);
  });

  it("saves the edited copy through the action", async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        def={def}
        initial={initial}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    const subject = screen.getByDisplayValue(initial.subject);
    await user.clear(subject);
    await user.type(subject, "Welcome back");
    await user.click(screen.getByRole("button", { name: "Save template" }));
    expect(saveTemplateAction).toHaveBeenCalledWith(
      "sign_in_link",
      expect.objectContaining({ subject: "Welcome back" }),
      "csrf",
    );
  });

  it("sends a test of this template and offers a reset confirmation", async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        def={def}
        initial={initial}
        onClose={() => undefined}
        onSaved={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Send test to me" }));
    expect(testAction).toHaveBeenCalledWith("sign_in_link", "csrf");
    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByText("Reset this template?")).toBeInTheDocument();
  });
});
