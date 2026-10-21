import type { Action } from "../definition";
import type { ActionContext, StepResult } from "../runner";

// Action handlers register themselves here, so the runner never imports a concrete action (and a
// new action cannot be half-wired: if no handler registered, the step fails with a stable id).
export type ActionHandler = (ctx: ActionContext, action: Action) => Promise<StepResult>;

const HANDLERS = new Map<Action["type"], ActionHandler>();

export function registerActionHandler(type: Action["type"], handler: ActionHandler): void {
  HANDLERS.set(type, handler);
}

export function getActionHandler(type: Action["type"]): ActionHandler | undefined {
  return HANDLERS.get(type);
}

export function registeredActionTypes(): Action["type"][] {
  return [...HANDLERS.keys()];
}
