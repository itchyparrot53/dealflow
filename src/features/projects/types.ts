// Shared project shapes. Kept apart from the services so phases.ts and tasks.ts can use the view
// types without importing projects.ts (which imports them).

export const PROJECT_STATUSES = ["active", "on_hold", "completed", "cancelled"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface PhaseView {
  id: string;
  name: string;
  position: number;
}

export interface TaskView {
  id: string;
  projectId: string;
  phaseId: string | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  done: boolean;
  doneAt: string | null;
  position: number;
}

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  dealId: string | null;
  dealTitle: string | null;
  organizationId: string | null;
  personId: string | null;
  ownerId: string;
  ownerName: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  phases: PhaseView[];
  tasks: TaskView[];
  taskCount: number;
  doneCount: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  status: ProjectStatus;
  dealId: string | null;
  dealTitle: string | null;
  ownerId: string;
  ownerName: string;
  dueDate: string | null;
  taskCount: number;
  doneCount: number;
  updatedAt: string;
}

export interface ProjectFilter {
  status?: ProjectStatus;
  ownerId?: string;
  dealId?: string;
  search?: string;
}
