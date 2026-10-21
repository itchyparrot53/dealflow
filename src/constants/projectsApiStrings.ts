// Part 8 user-facing copy. Error ids stay in errorIds.ts; this map turns each one into the
// sentence a person reads, and the UI never prints a raw id.

export const PROJECTS_API_STRINGS = {
  errors: {
    E_PROJECT_001: "Project not found.",
    E_PROJECT_002: "That task or phase no longer exists.",
    E_PROJECT_003: "Only the project owner, an assignee or an admin can change this project.",
    E_PROJECT_004: "Check the project details and try again.",
    E_API_001: "Missing or malformed API token.",
    E_API_002: "This API token is unknown, revoked or expired.",
    E_API_003: "This token does not have write access.",
    E_API_004: "Too many requests. Try again shortly.",
    E_API_005: "Unknown API route or method.",
    E_API_006: "The request body or query is invalid.",
    E_RECYCLE_001: "That item can no longer be restored.",
    E_RECYCLE_002: "Restore the parent record first.",
    E_EXPORT_001: "You do not have permission to export data.",
    E_EXPORT_002: "Too many rows to export. Narrow the filter and try again.",
    E_BACKUP_001: "The backup failed. Check the server log for the failed step.",
    E_BACKUP_002: "That backup file was not found.",
    E_BACKUP_003: "Backups are disabled, or the backup directory is not writable.",
  },
  projects: {
    title: "Projects",
    newProject: "New project",
    addTask: "Add task",
    phases: "Phases",
    noPhase: "No phase",
  },
  api: {
    title: "API",
    tokensTab: "Tokens",
    docsTab: "Documentation",
    newToken: "New token",
    tokenOnce: "Copy this token now. You won't see it again.",
    revoke: "Revoke",
  },
  recycle: {
    title: "Recycle bin",
    retentionNote: "Items are permanently deleted after 30 days.",
    restore: "Restore",
  },
  export: {
    button: "Export CSV",
  },
  backups: {
    title: "Backups",
    backUpNow: "Back up now",
    restoreTitle: "How to restore",
  },
} as const;

export type ProjectsApiStringErrorId = keyof typeof PROJECTS_API_STRINGS.errors;
