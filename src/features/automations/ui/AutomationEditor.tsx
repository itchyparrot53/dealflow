"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { PILL_TAB, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AUTOMATIONS_STRINGS } from "@/constants/automationsStrings";
import { updateAutomationAction } from "../actions";
import { type AutomationDefinition, automationDefinitionSchema } from "../definition";
import type { Automation } from "../service";
import { ActionList } from "./ActionList";
import { ConditionEditor } from "./ConditionEditor";
import { RunLog } from "./RunLog";
import { TriggerPicker } from "./TriggerPicker";
import { defaultDefinition, type EditorLookups } from "./types";

const S = AUTOMATIONS_STRINGS;

function initialDefinition(automation: Automation, lookups: EditorLookups): AutomationDefinition {
  const parsed = automationDefinitionSchema.safeParse(automation.definition);
  return parsed.success ? parsed.data : defaultDefinition(lookups);
}

export function AutomationEditor({
  automation,
  lookups,
}: {
  automation: Automation;
  lookups: EditorLookups;
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(automation.name);
  const [description, setDescription] = useState(automation.description ?? "");
  const [enabled, setEnabled] = useState(automation.enabled);
  const [definition, setDefinition] = useState<AutomationDefinition>(
    initialDefinition(automation, lookups),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateAutomationAction(automation.id, {
      name,
      description: description === "" ? null : description,
      enabled,
      definition,
    });
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error.id === "E_AUTOMATION_INPUT_INVALID" ? S.editor.invalid : result.error.id,
      );
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Tabs defaultValue="definition" className="space-y-4">
      <TabsList className="gap-1">
        <TabsTrigger value="definition" className={PILL_TAB}>
          {S.editor.definition}
        </TabsTrigger>
        <TabsTrigger value="runs" className={PILL_TAB} data-testid="automation-runs-tab">
          {S.editor.runLog}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="definition">
        <form
          className="space-y-6"
          data-testid="automation-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block" htmlFor="automation-name">
              <span className="mb-1.5 block text-sm font-medium">{S.editor.name}</span>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-medium">{S.editor.enabled}</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                label={S.editor.enabled}
                testId="automation-enabled"
              />
            </div>
          </div>

          <label className="block" htmlFor="automation-description">
            <span className="mb-1.5 block text-sm font-medium">{S.editor.description}</span>
            <Textarea
              id="automation-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </label>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              {S.editor.when}
            </h2>
            <TriggerPicker
              value={definition.trigger}
              onChange={(trigger) => setDefinition({ ...definition, trigger })}
              lookups={lookups}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground">
              {S.editor.onlyIf}
            </h2>
            <ConditionEditor
              value={definition.condition}
              onChange={(condition) => setDefinition({ ...definition, condition })}
            />
          </section>

          <section className="space-y-3">
            <ActionList
              actions={definition.actions}
              onChange={(actions) => setDefinition({ ...definition, actions })}
              lookups={lookups}
            />
          </section>

          {error === null ? null : <p className="text-sm text-destructive">{error}</p>}
          {saved ? <p className="text-sm text-muted-foreground">{S.editor.saved}</p> : null}

          <Button type="submit" data-testid="automation-save" disabled={saving}>
            {saving ? S.editor.saving : S.editor.save}
          </Button>
        </form>
      </TabsContent>
      <TabsContent value="runs">
        <RunLog automationId={automation.id} />
      </TabsContent>
    </Tabs>
  );
}
