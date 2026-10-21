// Every public page carries this footer (PLAN-PART6 Definition of done 9). It is deliberately a
// plain server component: no client JS on pages a stranger's browser loads from another site.
export function PoweredBy(): React.ReactNode {
  return (
    <footer data-testid="powered-by" className="mt-10 text-center text-xs text-muted-foreground">
      Powered by Dealflow
    </footer>
  );
}
