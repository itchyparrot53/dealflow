// WCAG relative-luminance contrast, used by the accent guard (server) and the Branding tab's error
// copy (client). Kept out of layout.ts so importing it does not pull the renderer into the client.

export function contrastRatio(foreground: string, background: string): number {
  const toRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    return [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  };
  const luminance = (hex: string): number => {
    const [red = 0, green = 0, blue = 0] = toRgb(hex).map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
