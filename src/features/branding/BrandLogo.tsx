import type React from "react";
import { cn } from "@/lib/utils";

// The Dealflow brand kit's SVG masters, copied into public/brand at build time. Components never
// inline the SVG: the artwork keeps its brand hex out of TSX and the design checker stays at zero.
export type BrandLogoVariant = "mark" | "logo";
export type BrandLogoTone = "colour" | "reverse";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  tone?: BrandLogoTone;
  // Rendered height in CSS pixels. The width follows the artwork's aspect ratio.
  height: number;
  alt?: string;
  className?: string;
}

const ARTWORK = {
  mark: {
    colour: "/brand/dealflow-mark-colour.svg",
    reverse: "/brand/dealflow-mark-reverse.svg",
    width: 36,
    height: 36,
  },
  logo: {
    colour: "/brand/dealflow-logo-horizontal-colour.svg",
    reverse: "/brand/dealflow-logo-horizontal-reverse.svg",
    width: 173.34,
    height: 36,
  },
} as const;

export function BrandLogo({
  variant = "logo",
  tone = "colour",
  height,
  alt = "Dealflow",
  className,
}: BrandLogoProps): React.ReactNode {
  const artwork = ARTWORK[variant];
  const width = Math.round((height * artwork.width) / artwork.height);
  return (
    // biome-ignore lint/performance/noImgElement: public brand SVG; next/image would need dangerouslyAllowSVG
    <img
      src={artwork[tone]}
      alt={alt}
      width={width}
      height={height}
      className={cn("shrink-0", className)}
    />
  );
}
