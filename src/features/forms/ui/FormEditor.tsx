"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FORMS_STRINGS } from "@/constants/formsBookingStrings";
import { readCsrfToken } from "@/utils/csrfCookie";
import { updateFormAction } from "../actions";
import type { FormField as FormFieldDef } from "../fields";
import { EmbedCode } from "./EmbedCode";
import { type CustomFieldOptionView, FieldList } from "./FieldList";
import { SubmissionsTable } from "./SubmissionsTable";

const S = FORMS_STRINGS;

export interface FormEditorView {
  id: string;
  publicId: string;
  name: string;
  title: string;
  description: string | null;
  fields: FormFieldDef[];
  creates: "lead" | "deal";
  pipelineId: string | null;
  stageId: string | null;
  ownerId: string;
  successMessage: string;
  redirectUrl: string | null;
  active: boolean;
}

export interface FormEditorLookups {
  pipelines: { id: string; name: string; stages: { id: string; name: string }[] }[];
  users: { id: string; name: string }[];
  customFields: CustomFieldOptionView[];
}

export function FormEditor({
  form,
  lookups,
  baseUrl,
}: {
  form: FormEditorView;
  lookups: FormEditorLookups;
  baseUrl: string;
}): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState(form.name);
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [creates, setCreates] = useState<"lead" | "deal">(form.creates);
  const [pipelineId, setPipelineId] = useState(form.pipelineId ?? lookups.pipelines[0]?.id ?? "");
  const [stageId, setStageId] = useState(form.stageId ?? lookups.pipelines[0]?.stages[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(form.ownerId);
  const [successMessage, setSuccessMessage] = useState(form.successMessage);
  const [redirectUrl, setRedirectUrl] = useState(form.redirectUrl ?? "");
  const [fields, setFields] = useState<FormFieldDef[]>(form.fields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pipeline = lookups.pipelines.find((entry) => entry.id === pipelineId);

  function changePipeline(next: string): void {
    setPipelineId(next);
    const firstStage = lookups.pipelines.find((entry) => entry.id === next)?.stages[0]?.id ?? "";
    setStageId(firstStage);
  }

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateFormAction(
      form.id,
      {
        name,
        title,
        description: description.trim() === "" ? null : description,
        fields,
        creates,
        pipelineId: creates === "deal" ? pipelineId : null,
        stageId: creates === "deal" ? stageId : null,
        ownerId,
        successMessage,
        redirectUrl: redirectUrl.trim() === "" ? null : redirectUrl.trim(),
      },
      readCsrfToken(),
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error.id);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6" data-testid="form-editor">
      <Tabs defaultValue="definition" className="space-y-4">
        <TabsList className="gap-1">
          <TabsTrigger value="definition">{S.editor.definition}</TabsTrigger>
          <TabsTrigger value="submissions">{S.editor.submissions}</TabsTrigger>
        </TabsList>

        <TabsContent value="definition" className="space-y-4">
          <FormGrid columns={2}>
            <FormField label={S.editor.name} htmlFor="form-name">
              <Input
                id="form-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField label={S.editor.title} htmlFor="form-title">
              <Input
                id="form-title"
                value={title}
                maxLength={150}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>
            <div data-span="full">
              <FormField label={S.editor.description} htmlFor="form-description">
                <Textarea
                  id="form-description"
                  value={description}
                  maxLength={1000}
                  rows={2}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label={S.editor.creates}>
              <Select
                value={creates}
                onChange={(value) => setCreates(value === "deal" ? "deal" : "lead")}
                options={[
                  { value: "lead", label: S.creates.lead },
                  { value: "deal", label: S.creates.deal },
                ]}
                ariaLabel={S.editor.creates}
                testId="form-creates-select"
              />
            </FormField>
            <FormField label={S.editor.owner}>
              <Select
                value={ownerId}
                onChange={setOwnerId}
                options={lookups.users.map((user) => ({ value: user.id, label: user.name }))}
                ariaLabel={S.editor.owner}
              />
            </FormField>
            {creates === "deal" ? (
              <>
                <FormField label={S.editor.pipeline}>
                  <Select
                    value={pipelineId}
                    onChange={changePipeline}
                    options={lookups.pipelines.map((entry) => ({
                      value: entry.id,
                      label: entry.name,
                    }))}
                    ariaLabel={S.editor.pipeline}
                  />
                </FormField>
                <FormField label={S.editor.stage}>
                  <Select
                    value={stageId}
                    onChange={setStageId}
                    options={(pipeline?.stages ?? []).map((stage) => ({
                      value: stage.id,
                      label: stage.name,
                    }))}
                    ariaLabel={S.editor.stage}
                  />
                </FormField>
              </>
            ) : null}
            <FormField label={S.editor.successMessage} htmlFor="form-success-message">
              <Input
                id="form-success-message"
                value={successMessage}
                maxLength={1000}
                onChange={(e) => setSuccessMessage(e.target.value)}
              />
            </FormField>
            <FormField label={S.editor.redirectUrl} htmlFor="form-redirect-url">
              <Input
                id="form-redirect-url"
                value={redirectUrl}
                maxLength={2000}
                placeholder="https://example.com/thanks"
                onChange={(e) => setRedirectUrl(e.target.value)}
              />
            </FormField>
          </FormGrid>

          <FieldList fields={fields} onChange={setFields} customFields={lookups.customFields} />

          <section className="space-y-2 rounded-md border p-3">
            <h2 className="text-sm font-medium">{S.editor.livePreview}</h2>
            <p className="text-base font-semibold">{title}</p>
            {description.trim() === "" ? null : (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <p className="text-xs font-medium">
                    {field.label}
                    {field.required ? " *" : ""}
                  </p>
                  <div className="h-8 rounded-md border bg-muted/40" />
                </div>
              ))}
            </div>
          </section>

          <EmbedCode publicId={form.publicId} title={title} baseUrl={baseUrl} />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              data-testid="form-save"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? S.editor.saving : S.editor.save}
            </Button>
            {saved ? <span className="text-sm text-muted-foreground">{S.editor.saved}</span> : null}
            {error === null ? null : <span className="text-sm text-destructive">{error}</span>}
          </div>
        </TabsContent>

        <TabsContent value="submissions">
          <SubmissionsTable formId={form.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
