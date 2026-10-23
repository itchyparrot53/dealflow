// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The flag is read through the clientEnv object at render time, so a getter lets each test choose
// the build state without re-importing the module.
const state = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/config/clientEnv", () => ({
  clientEnv: {
    get PWA_UI(): boolean {
      return state.enabled;
    },
    WS_PUBLIC_URL: "",
  },
}));
vi.mock("@/lib/trpc-client", () => ({
  trpc: { push: { config: { useQuery: () => ({ data: undefined }) } } },
}));

import { NOTIFICATION_TYPES, type NotificationType } from "@/constants/notificationTypes";
import { PreferencesForm } from "@/features/notifications/ui/PreferencesForm";
import { PushSettings } from "@/features/push/ui/PushSettings";
import { InstallButton } from "./InstallButton";
import { OfflineBanner } from "./OfflineBanner";

beforeEach(() => {
  state.enabled = false;
});
afterEach(cleanup);

describe("hidden PWA UI (6.4)", () => {
  it("renders no install button while the flag is off", () => {
    const { container } = render(<InstallButton variant="settings" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the install card content when the flag is on", () => {
    state.enabled = true;
    render(<InstallButton variant="settings" />);
    expect(screen.getByTestId("install-app")).toBeInTheDocument();
  });

  it("renders no offline banner while the flag is off", () => {
    const { container } = render(<OfflineBanner />);
    fireEvent(window, new Event("offline"));
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("renders the offline banner when the flag is on and the browser is offline", () => {
    state.enabled = true;
    render(<OfflineBanner />);
    fireEvent(window, new Event("offline"));
    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
  });

  it("renders no push settings while the flag is off", () => {
    const { container } = render(<PushSettings />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("push-settings")).toBeNull();
  });

  it("renders push settings when the flag is on", () => {
    state.enabled = true;
    render(<PushSettings />);
    expect(screen.getByTestId("push-settings")).toBeInTheDocument();
  });

  const prefs = Object.fromEntries(
    NOTIFICATION_TYPES.map((type) => [type, { inApp: true, email: true, push: true }]),
  ) as Record<NotificationType, { inApp: boolean; email: boolean; push: boolean }>;

  it("hides the Push column in notification preferences while the flag is off", () => {
    render(<PreferencesForm prefs={prefs} onChange={() => {}} showPush={false} />);
    expect(screen.queryAllByTestId("push-pref")).toHaveLength(0);
    expect(screen.getAllByLabelText("In-app").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Email").length).toBeGreaterThan(0);
  });

  it("shows the Push column with the flag on", () => {
    render(<PreferencesForm prefs={prefs} onChange={() => {}} showPush />);
    expect(screen.getAllByTestId("push-pref").length).toBeGreaterThan(0);
  });
});
