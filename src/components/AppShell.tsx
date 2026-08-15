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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <AppSidebar
        role={role}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`min-h-screen transition-[margin] duration-150 ${expanded ? SIDEBAR_MARGIN_CLASS.expanded : SIDEBAR_MARGIN_CLASS.collapsed}`}>
        <AppHeader userEmail={userEmail} breadcrumb={breadcrumb} onOpenMobileNav={() => setMobileOpen(true)} />

        <main className="px-4 py-6 sm:px-6 sm:py-10 md:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </>
  );
}
