import type { TaskView } from "../types";

// The board's optimistic move, kept pure so the ordering rule is testable without a browser.
// Positions are dense and zero-based inside each phase column. Moving within a column reorders
// that column; moving across columns renumbers both (the same rule tasks.moveTask applies).

function columnOf(tasks: TaskView[], phaseId: string | null): TaskView[] {
  return tasks.filter((task) => task.phaseId === phaseId).sort((a, b) => a.position - b.position);
}

export function applyMove(
  tasks: TaskView[],
  taskId: string,
  targetPhaseId: string | null,
  targetIndex: number,
): TaskView[] {
  const moved = tasks.find((task) => task.id === taskId);
  if (moved === undefined) return tasks;
  const sourcePhaseId = moved.phaseId;
  const others = tasks.filter((task) => task.id !== taskId);

  const target = columnOf(others, targetPhaseId);
  const at = Math.max(0, Math.min(targetIndex, target.length));
  target.splice(at, 0, { ...moved, phaseId: targetPhaseId });

  const positions = new Map<string, number>();
  for (const [index, task] of target.entries()) positions.set(task.id, index);
  if (sourcePhaseId !== targetPhaseId) {
    for (const [index, task] of columnOf(others, sourcePhaseId).entries()) {
      positions.set(task.id, index);
    }
  }

  return tasks.map((task) => {
    const position = positions.get(task.id);
    if (position === undefined) return task;
    if (task.id === taskId) return { ...task, phaseId: targetPhaseId, position };
    return { ...task, position };
  });
}
