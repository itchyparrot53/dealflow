// @vitest-environment jsdom
// src/components/ui/dialog.test.tsx
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Select } from "./Select";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
});

function DialogWithSelect({ onClose }: { onClose: () => void }): React.ReactNode {
  const [visibility, setVisibility] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add deal</DialogTitle>
        </DialogHeader>
        <Select
          ariaLabel="Visible to"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "", label: "Default" },
            { value: "g1", label: "Sales" },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}

// Radix arms its document-level `pointerdown` listener inside a setTimeout(0), and defers the
// dialog's dismissal to a second setTimeout(0) after the click. Both need a real macrotask to
// elapse, so every step of these tests is separated by one.
async function tick(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// The overlay is `fixed inset-0` and sits UNDER the content, so it is the element a real browser
// hit-tests to whenever the content is not accepting pointer events.
function getOverlay(): HTMLElement {
  const overlay = document.querySelector<HTMLElement>("div.fixed.inset-0");
  if (overlay === null) throw new Error("dialog overlay not found");
  return overlay;
}

// A real browser resolves a press over the dialog body to whichever element wins the hit test.
// While a nested Select is open, Radix sets the dialog CONTENT layer to `pointer-events: none`
// (it is no longer the topmost layer) while the overlay keeps `pointer-events: auto`, so the
// press lands on the overlay, i.e. "outside" the content. jsdom does no hit-testing, so the test
// dispatches onto the overlay directly to mirror what the browser actually does.
function pressAndRelease(target: HTMLElement): void {
  fireEvent.pointerDown(target, { button: 0, pointerType: "mouse" });
  fireEvent.mouseDown(target, { button: 0 });
  fireEvent.pointerUp(target, { button: 0, pointerType: "mouse" });
  fireEvent.mouseUp(target, { button: 0 });
  fireEvent.click(target, { button: 0 });
}

describe("Dialog", () => {
  // Regression: opening the "Visible to" Select inside Add deal and then clicking back on the
  // modal without picking anything closed the whole modal. Radix Dialog defers its
  // pointer-down-outside dismissal to the following `click`; the dismissal guard has to be
  // evaluated at pointer-down time, while the Select layer is still on top, not at click time
  // when the Select has already closed and the dialog is topmost again.
  it("stays open when a press that dismisses a nested Select lands on the overlay", async () => {
    const onClose = vi.fn();
    render(<DialogWithSelect onClose={onClose} />);
    await tick();

    fireEvent.click(screen.getByLabelText("Visible to"));
    await tick();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    pressAndRelease(getOverlay());
    await tick();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // The guard above must not disable the overlay's real job: with no nested layer open, pressing
  // the backdrop still dismisses the dialog.
  it("closes when the overlay is pressed with no nested layer open", async () => {
    const onClose = vi.fn();
    render(<DialogWithSelect onClose={onClose} />);
    await tick();

    pressAndRelease(getOverlay());
    await tick();

    expect(onClose).toHaveBeenCalled();
  });
});

// Part 12, 6.2: the close button belongs to the header, the body is the only scroll container, and
// a headerless dialog must ask for the corner button or none at all.
describe("Dialog anatomy", () => {
  function renderDialog(closeButton?: "header" | "corner" | "none"): void {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined} closeButton={closeButton}>
          <DialogHeader>
            <DialogTitle>Add deal</DialogTitle>
          </DialogHeader>
          <DialogBody>fields</DialogBody>
          <DialogFooter>
            <button type="button">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
  }

  it("renders the close button inside the header, not on the dialog corner", () => {
    renderDialog();
    const header = document.querySelector('[data-slot="dialog-header"]');
    const close = screen.getByTestId("dialog-close");
    expect(header).toContainElement(close);
    expect(close.className).not.toContain("absolute");
  });

  it("makes DialogBody the only scroll container", () => {
    renderDialog();
    const header = document.querySelector('[data-slot="dialog-header"]');
    const body = document.querySelector('[data-slot="dialog-body"]');
    const footer = document.querySelector('[data-slot="dialog-footer"]');
    expect(body?.className).toContain("overflow-y-auto");
    expect(header?.className).not.toContain("overflow-y-auto");
    expect(footer?.className).not.toContain("overflow-y-auto");
    // The dialog itself clips, so the header and footer can never be scrolled away.
    expect(header?.parentElement?.className).toContain("overflow-hidden");
  });

  it("renders a corner close for a dialog without a header", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined} closeButton="corner">
          <DialogTitle>Preview</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const close = screen.getByTestId("dialog-close");
    expect(close.className).toContain("absolute");
    expect(document.querySelector('[data-slot="dialog-header"]')).toBeNull();
  });

  it("renders no close button with closeButton=none", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined} closeButton="none">
          <DialogTitle>Must be answered</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByTestId("dialog-close")).not.toBeInTheDocument();
  });
});
