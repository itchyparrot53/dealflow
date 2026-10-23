// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ThreadMessage } from "./emailReads";
import { ReaderMessageCard } from "./ReaderMessageCard";

afterEach(cleanup);

const MESSAGE: ThreadMessage = {
  messageId: "<m1@example.net>",
  providerMessageId: "m1",
  direction: "inbound",
  fromEmail: "mia@example.net",
  fromName: "Mia Novak",
  toEmails: ["me@example.net"],
  ccEmails: [],
  subject: "Hello",
  bodyHtml: "<p>Hi</p>",
  sentAt: "2026-07-02T10:00:00.000Z",
  attachments: [],
  tracking: [],
};

it("offers Show remote content from the card header until it is revealed", () => {
  const onShowRemote = vi.fn();
  render(<ReaderMessageCard message={MESSAGE} allowRemote={false} onShowRemote={onShowRemote} />);
  const button = screen.getByRole("button", { name: "Show remote content" });
  fireEvent.click(button);
  expect(onShowRemote).toHaveBeenCalledTimes(1);
});

it("hides the remote-content control once remote content is allowed", () => {
  render(<ReaderMessageCard message={MESSAGE} allowRemote onShowRemote={() => {}} />);
  expect(screen.queryByRole("button", { name: "Show remote content" })).toBeNull();
});
