"use client";
import type React from "react";
import { AiFilterButton } from "@/features/ai/ui/AiFilterButton";
import { SavedViewControl } from "@/features/saved-filters/SavedViewControl";
import type { SavedView } from "@/features/saved-filters/savedView";
import { savedFilterDefinitionSchema } from "@/features/saved-filters/schemas";
import { ContactFilterBuilder } from "./ContactFilterBuilder";
import { type ContactFilterDefinition, ORG_FILTER_CONFIG } from "./contactFilterConfig";
import { ORG_FILTER_LABELS } from "./contactFilterRows";

export interface OrgsListToolbarProps {
  filter: ContactFilterDefinition | null;
  savedViewId: string | null;
  onSelectView: (view: SavedView | null) => void;
  onApplyFilter: (def: ContactFilterDefinition | null) => void;
}

export function OrgsListToolbar({
  filter,
  savedViewId,
  onSelectView,
  onApplyFilter,
}: OrgsListToolbarProps): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <SavedViewControl
        targetEntity="organization"
        allLabel="All organizations"
        currentDefinition={filter}
        selectedViewId={savedViewId}
        onSelectView={onSelectView}
      />
      <ContactFilterBuilder
        config={ORG_FILTER_CONFIG}
        fieldLabels={ORG_FILTER_LABELS}
        activeCount={filter?.conditions.length ?? 0}
        appliedDefinition={filter}
        onApply={onApplyFilter}
      />
      <AiFilterButton
        entity="organization"
        onDefinition={(definition) => {
          const parsed = savedFilterDefinitionSchema("organization").safeParse(definition);
          if (parsed.success) onApplyFilter(parsed.data);
        }}
      />
    </div>
  );
}
