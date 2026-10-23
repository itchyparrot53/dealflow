// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "./sheet";

afterEach(cleanup);

it("puts the close button in the header when the sheet asks for it", () => {
  render(
    <Sheet open>
      <SheetContent closeButton="header">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <SheetBody>body</SheetBody>
      </SheetContent>
    </Sheet>,
  );
  const header = document.querySelector('[data-slot="dialog-header"]');
  const close = screen.getByTestId("dialog-close");
  expect(header).toContainElement(close);
  expect(close.className).not.toContain("absolute");
});

it("keeps the corner close for the existing custom sheets", () => {
  render(
    <Sheet open>
      <SheetContent>
        <SheetTitle>Reply</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  expect(screen.getByTestId("dialog-close").className).toContain("absolute");
});

it("renders no close button with closeButton=none", () => {
  render(
    <Sheet open>
      <SheetContent closeButton="none">
        <SheetTitle>Locked</SheetTitle>
      </SheetContent>
    </Sheet>,
  );
  expect(screen.queryByTestId("dialog-close")).not.toBeInTheDocument();
});
