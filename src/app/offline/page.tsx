"use client";
import type React from "react";
import { Button } from "@/components/ui/Button";

// The offline shell is served by the service worker when a navigation fails. It lives outside the
// (app) group so it needs no session, and it is client rendered: Task 1.3 fills it from IndexedDB.
export default function OfflinePage(): React.ReactNode {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">You're offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Dealflow can't reach the server. Records you opened while online will appear here once they
        have been saved.
      </p>
      <Button type="button" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </main>
  );
}
