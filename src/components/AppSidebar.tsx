"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Role } from "@/lib/profile";
import {
  AiIcon,
  ChartIcon,
  ChevronIcon,
  ContractedIcon,
  LeadsIcon,
  PriorityIcon,
  ProductivityIcon,
  ProjectsIcon,
  ReferralIcon,
  SowIcon,
  TeamIcon,
  type IconProps,
} from "./dashboard/NavIcons";

export type Tab =
  | "today"
  | "financial"
  | "ai-analytics"
  | "leads"
  | "referrals"
  | "contracted"
  | "productivity"
  | "projects"
  | "sow"
  | "team";

// "Priorities" (nav key "today", unchanged for URL/state stability) sits
// second per the product distinction: Financial Dashboard answers "how are
// we doing?", Priorities answers "what should we do?" — the owner wanted
// the established Financial Dashboard landing experience to stay first.
export const TABS: { key: Tab; label: string; description: string; Icon: (props: IconProps) => React.JSX.Element }[] = [
  { key: "financial", label: "Financial Dashboard", description: "Revenue, forecast, and business mix", Icon: ChartIcon },
  { key: "ai-analytics", label: "AI Analytics", description: "What's affecting revenue, and market intel", Icon: AiIcon },
  { key: "today", label: "Priorities", description: "What needs attention today", Icon: PriorityIcon },
  { key: "leads", label: "Leads", description: "Intake and follow-up pipeline", Icon: LeadsIcon },
  { key: "referrals", label: "Referral Sources", description: "Revenue by referral relationship", Icon: ReferralIcon },
  { key: "contracted", label: "Contracted Work", description: "Subcontractor hours and cost", Icon: ContractedIcon },
  { key: "productivity", label: "Productivity", description: "Hours logged by person", Icon: ProductivityIcon },
  { key: "projects", label: "Projects", description: "All projects and billing status", Icon: ProjectsIcon },
  { key: "sow", label: "Business Not Materialized", description: "Proposals that didn't convert", Icon: SowIcon },
  { key: "team", label: "Admin", description: "Users, access, and backups", Icon: TeamIcon },
];

export const TAB_KEYS = TABS.map((t) => t.key);

export const SIDEBAR_WIDTH_CLASS = { collapsed: "w-16", expanded: "w-56" } as const;
export const SIDEBAR_MARGIN_CLASS = { collapsed: "ml-16", expanded: "ml-56" } as const;

function tabHref(key: Tab): string {
  return key === "financial" ? "/" : `/?tab=${key}`;
}

/**
 * Shared across the dashboard and every sub-page (project detail, etc.) so
 * navigation and layout width are identical everywhere — previously each
 * page built its own header/width, which is what made pages feel
 * inconsistent. Owns nothing about page content; only nav + its own
 * expand/collapse state (lifted out via props so the page can size its
 * main-content margin to match).
 */
export function AppSidebar({
  role,
  expanded,
  onToggleExpanded,
}: {
  role: Role | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only the dashboard root has an "active" tab — a sub-page like project
  // detail has none of these highlighted, even though the nav is present.
  const activeTab: Tab | null = pathname === "/" ? ((searchParams.get("tab") as Tab | null) ?? "financial") : null;

  const visibleTabs = TABS.filter((t) => t.key !== "team" || role === "owner");
  const width = expanded ? SIDEBAR_WIDTH_CLASS.expanded : SIDEBAR_WIDTH_CLASS.collapsed;

  return (
    <aside className={`fixed left-0 top-0 z-30 flex h-screen ${width} flex-col border-r border-line bg-canvas transition-[width] duration-150`}>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-3">
        {visibleTabs.map((t) => (
          <div key={t.key} className="group relative px-2">
            <button
              onClick={() => router.push(tabHref(t.key))}
              className={`flex w-full items-center gap-3 rounded px-2.5 py-2.5 text-left transition ${
                activeTab === t.key ? "bg-brand-primary text-white" : "text-ink/60 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <t.Icon className="h-[18px] w-[18px] shrink-0" />
              {expanded && <span className="truncate font-mono text-[11px] uppercase tracking-wide">{t.label}</span>}
            </button>

            {!expanded && (
              <div className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-ink px-2.5 py-1.5 text-xs text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100">
                <div className="font-medium">{t.label}</div>
                <div className="text-[10.5px] text-white/70">{t.description}</div>
              </div>
            )}
          </div>
        ))}
      </nav>

      <button
        onClick={onToggleExpanded}
        className="flex items-center justify-center gap-2 border-t border-line py-3 text-ink/50 hover:text-ink"
        title={expanded ? "Collapse" : "Expand"}
      >
        <ChevronIcon direction={expanded ? "left" : "right"} className="h-4 w-4" />
        {expanded && <span className="font-mono text-[10px] uppercase tracking-wide">Collapse</span>}
      </button>
    </aside>
  );
}
