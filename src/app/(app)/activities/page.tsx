import { redirect } from "next/navigation";

// design-ok: this route only redirects to the activities list.

// The primary nav links to /activities; land on the to-do list (Pipedrive's
// default Activities view), with the calendar available via the view toggle.
export default function ActivitiesIndexPage(): never {
  redirect("/activities/list");
}
