# Projects

Projects group work into phases and tasks. A project can be linked to a deal, an organization and
a person, and every project starts with the three phases Kickoff, Delivery and Wrap-up unless the
creator supplies their own list.

## Who can see and change a project

- A project linked to a deal follows that deal's visibility: anyone who can see the deal sees the
  project, and nobody else does.
- An unlinked project is visible to every signed-in user.
- The owner, anyone assigned a task in the project, and admins may edit it. Everyone else sees it
  read-only.

## The board

`/projects` lists the visible projects with status, linked deal, owner, done/total progress and due
date, plus status, owner and search filters. Opening one shows the board: one column per phase
(and a "No phase" column when tasks have none). Drag a card between columns or within one to
reorder; the move is optimistic and rolls back with an inline error if the server refuses it. The
Phases popover adds, renames, reorders and deletes phases; deleting a phase leaves its tasks in
"No phase".

## From a deal

A won deal's sidebar shows a Projects section with **Create project**. It creates a project named
after the deal, links the deal, person and organization, and makes the deal owner the project
owner. The user path only accepts won deals; automations may start a project on any deal in their
trigger.

## Notifications and events

Assigning a task to someone else creates one `project_task_assigned` notification for them (email
on by default). Project events reach automations and webhooks:

- `project.created`
- `project.status_changed`
- `project.deleted`
- `project_task.completed`

A project event's automation condition runs against the linked deal; an unlinked project skips the
run.
