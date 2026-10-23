import type React from "react";
import { ListPageSkeleton } from "@/components/shell/skeletons";

// Instant navigation fallback while the project list query runs.
export default function Loading(): React.ReactNode {
  return <ListPageSkeleton />;
}
