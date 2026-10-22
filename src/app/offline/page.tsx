import type React from "react";
import { OfflineApp } from "@/features/pwa/offline/ui/OfflineApp";

// Outside the (app) group: the service worker can serve this page with no session, and it renders
// statically. The data comes from IndexedDB, never from a cached server response.
export default function OfflinePage(): React.ReactNode {
  return <OfflineApp />;
}
