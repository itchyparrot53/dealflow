import { describe, expect, it, vi } from "vitest";

// next/font/local is compiled by the Next.js build loader and cannot run under Vitest, so we stub
// it. The stub returns a sentinel `variable` class; the layout must apply that class to the document
// root so Tailwind's `--font-sans` resolves to Inter. This asserts the WIRING (font var is attached),
// which is the part that silently breaks, not the font bytes.
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "__inter_sentinel_var", className: "__inter_sentinel_class" }),
}));
vi.mock("@/components/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

describe("root layout", () => {
  it("applies the Inter font variable class to the document root", async () => {
    const { default: RootLayout } = await import("./layout");
    const tree = RootLayout({ children: null }) as { props: { className?: string } };
    expect(tree.props.className).toContain("__inter_sentinel_var");
    // Keeps the existing antialiasing hint.
    expect(tree.props.className).toContain("antialiased");
  });

  it("builds social previews from the app base URL", async () => {
    const { metadata } = await import("./layout");
    // JSON removes the URL instance while keeping the absolute value the metadata resolver emits.
    const plain = JSON.parse(JSON.stringify(metadata)) as {
      metadataBase: string;
      openGraph: {
        siteName: string;
        images: { url: string; width: number; height: number; alt: string }[];
      };
      twitter: {
        card: string;
        images: { url: string; width: number; height: number; alt: string }[];
      };
    };
    expect(plain.metadataBase).toBe("https://app.example.com/");
    expect(plain.openGraph.siteName).toBe("Dealflow");
    expect(plain.openGraph.images[0]).toEqual({
      url: "/og/og-image-1200x630.png",
      width: 1200,
      height: 630,
      alt: "Dealflow",
    });
    expect(plain.twitter.card).toBe("summary_large_image");
    expect(plain.twitter.images[0]).toEqual({
      url: "/og/x-card-1200x675.png",
      width: 1200,
      height: 675,
      alt: "Dealflow",
    });
  });
});
