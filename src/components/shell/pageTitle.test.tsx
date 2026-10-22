// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PageTitle, PageTitleProvider, usePageTitleValue } from "./pageTitle";

afterEach(cleanup);

function TitleReader(): React.ReactNode {
  const { title, info } = usePageTitleValue();
  return (
    <p>
      {title}
      {info === undefined ? "" : `: ${info}`}
    </p>
  );
}

it("publishes a page's title and info to the shell", () => {
  render(
    <PageTitleProvider>
      <PageTitle title="Deals" info="Every deal you can see" />
      <TitleReader />
    </PageTitleProvider>,
  );
  expect(screen.getByText("Deals: Every deal you can see")).toBeInTheDocument();
});

it("renders nothing and does not throw outside a provider", () => {
  render(<PageTitle title="Public" />);
  expect(screen.queryByText("Public")).toBeNull();
});
