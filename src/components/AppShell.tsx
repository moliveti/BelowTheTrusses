"use client";

import { useState } from "react";
import type { Role } from "@/lib/profile";
import { AppSidebar, SIDEBAR_MARGIN_CLASS } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

/**
 * The sidebar + sticky header + width-matched main content wrapper, shared
 * by every page (dashboard tabs and sub-pages like project detail) so
 * navigation and layout width are identical everywhere. A client component
 * since it owns the expand/collapse state, but it's fine to render from a
 * Server Component page — `children` can be server-rendered content.
 */
export function AppShell({
  role,
  userEmail,
  breadcrumb,
  children,
}: {
  role: Role | null;
  userEmail: string | undefined;
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <>
      <AppSidebar role={role} expanded={expanded} onToggleExpanded={() => setExpanded((v) => !v)} />

      <div className={`min-h-screen transition-[margin] duration-150 ${expanded ? SIDEBAR_MARGIN_CLASS.expanded : SIDEBAR_MARGIN_CLASS.collapsed}`}>
        <AppHeader userEmail={userEmail} breadcrumb={breadcrumb} />

        <main className="px-6 py-10 md:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
