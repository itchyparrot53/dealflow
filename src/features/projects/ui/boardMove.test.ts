import { describe, expect, it } from "vitest";
import type { TaskView } from "../types";
import { applyMove } from "./boardMove";

function task(id: string, phaseId: string | null, position: number): TaskView {
  return {
    id,
    projectId: "p",
    phaseId,
    title: id,
    description: null,
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    done: false,
    doneAt: null,
    position,
  };
}

const ordered = (tasks: TaskView[], phaseId: string | null): string[] =>
  tasks
    .filter((row) => row.phaseId === phaseId)
    .sort((a, b) => a.position - b.position)
    .map((row) => row.id);

describe("applyMove", () => {
  const tasks = [task("a", "one", 0), task("b", "one", 1), task("c", "one", 2)];

  it("reorders within one column and keeps positions dense", () => {
    const next = applyMove(tasks, "c", "one", 0);
    expect(ordered(next, "one")).toEqual(["c", "a", "b"]);
    expect(
      next
        .filter((row) => row.phaseId === "one")
        .sort((a, b) => a.position - b.position)
        .map((row) => row.position),
    ).toEqual([0, 1, 2]);
  });

  it("moves across columns and renumbers the source column", () => {
    const withTarget = [
      task("a", "one", 0),
      task("b", "one", 1),
      task("x", "two", 0),
      task("y", "two", 1),
    ];
    const next = applyMove(withTarget, "a", "two", 1);
    expect(ordered(next, "two")).toEqual(["x", "a", "y"]);
    expect(ordered(next, "one")).toEqual(["b"]);
    expect(next.find((row) => row.id === "b")?.position).toBe(0);
  });

  it("moves into the no-phase column", () => {
    const next = applyMove(tasks, "b", null, 0);
    expect(ordered(next, null)).toEqual(["b"]);
    expect(ordered(next, "one")).toEqual(["a", "c"]);
  });

  it("clamps the index to the column length and ignores an unknown task", () => {
    const next = applyMove(tasks, "a", "one", 99);
    expect(ordered(next, "one")).toEqual(["b", "c", "a"]);
    expect(applyMove(tasks, "missing", "one", 0)).toEqual(tasks);
  });
});
