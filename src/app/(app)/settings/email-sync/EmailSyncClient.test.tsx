// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectGmailStart = vi.fn();
const disconnectMailboxAction = vi.fn();
const connectImapMailboxAction = vi.fn();
const refresh = vi.fn();

vi.mock("@/features/email/actions", () => ({
  connectGmailStart: () => connectGmailStart(),
  disconnectMailboxAction: (csrf: string | null, input: unknown) =>
    disconnectMailboxAction(csrf, input),
}));
vi.mock("@/features/mail/connect/actions", () => ({
  connectImapMailboxAction: (raw: unknown, csrf: string | null) =>
    connectImapMailboxAction(raw, csrf),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/utils/csrfCookie", () => ({ readCsrfToken: () => "csrf-token" }));

import { EmailSyncClient, type MailboxView } from "./EmailSyncClient";

const originalLocation = window.location;

const connected: MailboxView = {
  id: "acc-1",
  emailAddress: "rep@example.com",
  status: "connected",
  lastSyncAtIso: "2026-07-01T10:00:00.000Z",
  lastErrorId: null,
  provider: "gmail",
  imapHost: null,
};

const imap: MailboxView = {
  ...connected,
  provider: "imap",
  imapHost: "imap.purelymail.com",
};

beforeEach(() => {
  connectGmailStart.mockReset();
  disconnectMailboxAction.mockReset();
  connectImapMailboxAction.mockReset();
  refresh.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { href: "" } });
});
afterEach(() => {
  cleanup();
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("EmailSyncClient", () => {
  it("shows the connect form and the Gmail option when no mailbox is linked", async () => {
    connectGmailStart.mockResolvedValue({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
    });
    render(<EmailSyncClient mailbox={null} googleEnabled />);
    expect(screen.getByText("No mailbox is connected yet.")).toBeInTheDocument();
    expect(screen.getByTestId("connect-mailbox-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("App password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Connect Gmail instead" }));
    await waitFor(() =>
      expect(window.location.href).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1"),
    );
    expect(connectGmailStart).toHaveBeenCalledTimes(1);
  });

  it("hides the Gmail option when Google is not configured", () => {
    render(<EmailSyncClient mailbox={null} googleEnabled={false} />);
    expect(screen.queryByRole("button", { name: "Connect Gmail instead" })).toBeNull();
  });

  it("shows the connected address, provider, last sync, and Disconnect", () => {
    render(<EmailSyncClient mailbox={connected} googleEnabled={false} />);
    expect(screen.getByText("Connected as rep@example.com")).toBeInTheDocument();
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByText(/Last synced/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(screen.queryByTestId("connect-mailbox-form")).toBeNull();
  });

  it("shows the IMAP server and Update password for an IMAP mailbox", () => {
    render(<EmailSyncClient mailbox={imap} googleEnabled={false} />);
    expect(screen.getByText("IMAP/SMTP (imap.purelymail.com)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByTestId("connect-mailbox-form")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveValue("rep@example.com");
  });

  it("Disconnect calls the action with csrf + account id then refreshes", async () => {
    disconnectMailboxAction.mockResolvedValue({ ok: true, value: { disconnected: true } });
    render(<EmailSyncClient mailbox={connected} googleEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() =>
      expect(disconnectMailboxAction).toHaveBeenCalledWith("csrf-token", { accountId: "acc-1" }),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the connect form and the last error for a disconnected mailbox", () => {
    render(
      <EmailSyncClient
        mailbox={{ ...connected, status: "disconnected", lastErrorId: "E_GMAIL_002" }}
        googleEnabled
      />,
    );
    expect(screen.getByText(/E_GMAIL_002/)).toBeInTheDocument();
    expect(screen.getByTestId("connect-mailbox-form")).toBeInTheDocument();
  });

  it("posts the Purelymail preset and refreshes on success", async () => {
    connectImapMailboxAction.mockResolvedValue({ ok: true, value: { accountId: "acc-2" } });
    render(<EmailSyncClient mailbox={null} googleEnabled={false} />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "me@example.com" },
    });
    fireEvent.change(screen.getByLabelText("App password"), {
      target: { value: "fake-app-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test and connect" }));
    await waitFor(() =>
      expect(connectImapMailboxAction).toHaveBeenCalledWith(
        { emailAddress: "me@example.com", password: "fake-app-password-1", preset: "purelymail" },
        "csrf-token",
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the mapped message when the server rejects the app password", async () => {
    connectImapMailboxAction.mockResolvedValue({ ok: false, error: { id: "E_MAIL_004" } });
    render(<EmailSyncClient mailbox={null} googleEnabled={false} />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "me@example.com" },
    });
    fireEvent.change(screen.getByLabelText("App password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Test and connect" }));
    expect(await screen.findByTestId("connect-error")).toHaveTextContent(
      "The mail server rejected the email or app password.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("fills the disconnected status dot from a token so it shows on a dark card", () => {
    const { container } = render(<EmailSyncClient mailbox={null} googleEnabled={false} />);
    const dot = container.querySelector("[data-health]");
    expect(dot).toHaveClass("bg-muted-foreground/40");
    expect(dot?.className).not.toMatch(/-gray-/);
  });
});
