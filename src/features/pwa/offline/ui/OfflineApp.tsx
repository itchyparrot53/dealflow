"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PILL_TAB, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllOfflineRecords } from "../db";
import type { OfflineRecordType, OfflineSnapshot } from "../snapshots";
import { readOfflineUserId } from "../wipe";
import { OfflineList } from "./OfflineList";
import { OfflineRecord } from "./OfflineRecord";

const TABS: readonly { type: OfflineRecordType; label: string }[] = [
  { type: "deal", label: "Deals" },
  { type: "person", label: "People" },
  { type: "organization", label: "Organizations" },
  { type: "today", label: "Today" },
];

type Loaded = Record<OfflineRecordType, OfflineSnapshot[]>;

const EMPTY: Loaded = { deal: [], person: [], organization: [], today: [] };

// The /offline app: reads the last user's IndexedDB (see the shared-device note in PWA.md) and
// shows read-only copies. There is no session here, which is what lets the service worker serve
// this page when the network is gone.
export function OfflineApp(): React.ReactNode {
  const [records, setRecords] = useState<Loaded>(EMPTY);
  const [selected, setSelected] = useState<OfflineSnapshot | null>(null);

  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      const userId = readOfflineUserId();
      if (userId === null) return;
      const entries = await Promise.all(
        TABS.map(async (entry) => {
          const result = await getAllOfflineRecords(userId, entry.type);
          const list = result.ok ? result.value : [];
          return [
            entry.type,
            [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
          ] as const;
        }),
      );
      if (run.cancelled) return;
      setRecords(Object.fromEntries(entries) as Loaded);
    })();
    return () => {
      run.cancelled = true;
    };
  }, []);

  return (
    <main
      data-testid="offline-app"
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-display font-[450] leading-tight tracking-tight">You're offline</h1>
          <p className="text-sm text-muted-foreground">
            Records you opened while online. They are read-only.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </header>

      {selected === null ? (
        <Tabs defaultValue="deal">
          <TabsList className="gap-1 border-b pb-2">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.type}
                value={tab.type}
                data-testid="offline-tab"
                data-type={tab.type}
                className={`${PILL_TAB} min-h-10`}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((tab) => (
            <TabsContent key={tab.type} value={tab.type} className="mt-3">
              <OfflineList type={tab.type} records={records[tab.type]} onSelect={setSelected} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <OfflineRecord snapshot={selected} onBack={() => setSelected(null)} />
      )}
    </main>
  );
}
