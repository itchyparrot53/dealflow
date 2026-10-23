import type React from "react";
import { BoardSkeleton } from "@/components/shell/skeletons";

// The project detail is a board, so the fallback paints columns rather than a table.
export default function Loading(): React.ReactNode {
  return <BoardSkeleton />;
}
