"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SHORTCUT_HELP_GROUPS } from "./registry";

// The `?` help sheet (6.8). Generated from the same registry that drives the matcher, plus the
// shortcuts other components own (number row, j/k, the palette hotkey).
export function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactNode {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="shortcut-help" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press Escape to close this sheet.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SHORTCUT_HELP_GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-1 text-meta font-semibold text-muted-foreground">{group.title}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.keys}>
                      <td className="py-0.5 pr-3 align-top">
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {item.keys}
                        </kbd>
                      </td>
                      <td className="py-0.5 text-muted-foreground">{item.label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
