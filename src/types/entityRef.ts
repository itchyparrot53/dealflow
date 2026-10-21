import type { ENTITY_TYPES } from "@/constants/entityTypes";

// Canonical cross-phase reference shape (shared with Phase 3).
// One id plus its kind.
export interface EntityRef {
  kind: "person" | "organization" | "deal" | "lead" | "user";
  id: string;
}

export type EntityType = (typeof ENTITY_TYPES)[number];

// The change log can also record an activity or project restore (Part 8 recycle bin), which are
// not commentable timeline entities yet.
export type ChangeLogEntityType = EntityType | "activity" | "project";
