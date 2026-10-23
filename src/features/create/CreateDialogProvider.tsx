"use client";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/Select";
import { AddActivityModal } from "@/features/activities/AddActivityModal";
import { LogCallForm, type LogCallTarget } from "@/features/activities/calls/ui/LogCallForm";
import { AddDealModal } from "@/features/deals/AddDealModal";
import { NewProjectDialog } from "@/features/projects/ui/NewProjectDialog";
import { GlobalContactModal } from "@/features/quick-add/GlobalContactModal";
import { trpc } from "@/lib/trpc-client";

// Create-anywhere (6.9): one provider owns the existing create dialogs so the n sequences and the
// palette can open them in place instead of navigating to the page that hosts them. The page
// buttons keep their local dialogs; this is an additional entry point, not a replacement.
export type CreateKind = "deal" | "person" | "organization" | "activity" | "project" | "call";

export type CreateDefaults = {
  title?: string;
  dealId?: string;
  personId?: string;
  organizationId?: string;
};

type CreateContextValue = {
  openCreate: (kind: CreateKind, defaults?: CreateDefaults) => void;
};

// A no-op default keeps components renderable in isolation (unit tests) without a provider.
const CreateContext = createContext<CreateContextValue>({ openCreate: () => undefined });

export function useCreateDialog(): CreateContextValue {
  return useContext(CreateContext);
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// "Log call" from anywhere: use the record already on screen, else ask which person it was with.
function targetFromPath(pathname: string): LogCallTarget | null {
  const deal = new RegExp(`^/deals/(${UUID})`).exec(pathname);
  if (deal?.[1] !== undefined) return { dealId: deal[1] };
  const person = new RegExp(`^/contacts/people/(${UUID})`).exec(pathname);
  if (person?.[1] !== undefined) return { personId: person[1] };
  const org = new RegExp(`^/contacts/orgs/(${UUID})`).exec(pathname);
  if (org?.[1] !== undefined) return { organizationId: org[1] };
  return null;
}

function targetFromDefaults(defaults: CreateDefaults): LogCallTarget | null {
  if (defaults.dealId !== undefined)
    return { dealId: defaults.dealId, personId: defaults.personId };
  if (defaults.personId !== undefined) return { personId: defaults.personId };
  if (defaults.organizationId !== undefined) return { organizationId: defaults.organizationId };
  return null;
}

function CallTargetPicker({
  onPick,
  onClose,
}: {
  onPick: (target: LogCallTarget) => void;
  onClose: () => void;
}): React.ReactNode {
  const peopleQ = trpc.contacts.personOptions.useQuery();
  const [personId, setPersonId] = useState("");
  const people = peopleQ.data ?? [];
  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a call</DialogTitle>
          <DialogDescription>Choose the person the call was with.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Select
            ariaLabel="Person"
            value={personId}
            onChange={setPersonId}
            options={[
              { value: "", label: "Choose a person" },
              ...people.map((person) => ({ value: person.id, label: person.name })),
            ]}
          />
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            disabled={personId === ""}
            onClick={() => {
              const person = people.find((entry) => entry.id === personId);
              onPick({ personId, label: person?.name });
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateDialogProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState<{ kind: CreateKind; defaults: CreateDefaults } | null>(null);
  const [callTarget, setCallTarget] = useState<LogCallTarget | null>(null);

  const pipelinesQ = trpc.pipeline.list.useQuery();
  const pipelines = useMemo(
    () =>
      (pipelinesQ.data ?? []).map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        stages: pipeline.stages.map((stage) => ({ id: stage.id, name: stage.name })),
      })),
    [pipelinesQ.data],
  );
  const firstPipelineId = pipelines[0]?.id ?? null;

  const refresh = useCallback(() => router.refresh(), [router]);
  const close = useCallback(() => setActive(null), []);

  const openCreate = useCallback(
    (kind: CreateKind, defaults: CreateDefaults = {}) => {
      if (kind === "call") {
        const target = targetFromDefaults(defaults) ?? targetFromPath(pathname);
        if (target !== null) {
          setCallTarget(target);
          return;
        }
      }
      setActive({ kind, defaults });
    },
    [pathname],
  );

  return (
    <CreateContext.Provider value={{ openCreate }}>
      {children}

      {active?.kind === "deal" && firstPipelineId !== null && (
        <AddDealModal
          pipelineId={firstPipelineId}
          pipelines={pipelines}
          prefillTitle={active.defaults.title}
          onClose={close}
          onCreated={refresh}
        />
      )}
      {active?.kind === "person" && (
        <GlobalContactModal kind="person" onClose={close} onCreated={refresh} />
      )}
      {active?.kind === "organization" && (
        <GlobalContactModal kind="org" onClose={close} onCreated={refresh} />
      )}
      {active?.kind === "activity" && <AddActivityModal onClose={close} onCreated={refresh} />}
      {active?.kind === "project" && (
        <NewProjectDialog
          open
          onOpenChange={(next) => {
            if (!next) close();
          }}
          // The projects page passes its richer lists; from anywhere the optional deal and owner
          // simply start empty, which createProject already accepts.
          users={[]}
          dealOptions={[]}
        />
      )}
      {active?.kind === "call" && (
        <CallTargetPicker
          onClose={close}
          onPick={(target) => {
            setActive(null);
            setCallTarget(target);
          }}
        />
      )}
      {callTarget !== null && (
        <LogCallForm
          target={callTarget}
          open
          onClose={() => setCallTarget(null)}
          onSaved={() => {
            setCallTarget(null);
            refresh();
          }}
        />
      )}
    </CreateContext.Provider>
  );
}
