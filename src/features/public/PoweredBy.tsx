import { BrandLogo } from "@/features/branding/BrandLogo";

// Every public page carries this footer (PLAN-PART6 Definition of done 9). It is deliberately a
// plain server component: no client JS on pages a stranger's browser loads from another site.
// The mark is decorative because the adjacent text already names the product, and the footer
// links nowhere.
export function PoweredBy(): React.ReactNode {
  return (
    <footer data-testid="powered-by" className="mt-10 text-center text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <BrandLogo variant="mark" height={16} alt="" />
        <span>Powered by Dealflow</span>
      </span>
    </footer>
  );
}
