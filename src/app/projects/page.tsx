import { redirect } from "next/navigation";

// Projects now lives as a tab on the main dashboard (/?tab=projects)
// instead of a standalone page — keep this route as a redirect so any
// existing links/bookmarks still land somewhere sensible.
export default function ProjectsPage() {
  redirect("/?tab=projects");
}
