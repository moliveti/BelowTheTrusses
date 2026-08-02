# Roadmap — Below the Trusses Forecast & BI Tool

## Phase 0 — Foundation
- Set up Supabase project (Postgres + Auth).
- Set up Next.js app, deploy skeleton to Vercel.
- Implement schema from `02_DATA_MODEL.md`.
- Build the import script for the Excel → schema migration (idempotent, re-runnable).
- Invite owner + Amy Oliveti as users.

## Phase 1 — Core Dashboard (parity with prototype + agreed upgrades)
- KPI row with Collected/Committed toggle.
- YoY revenue chart with Collected/Committed toggle.
- Monthly breakdown table, single-year and multi-year comparison modes.
- Referral source list (lifetime) + year-over-year breakdown.
- Business mix donut with YTD / prior-year / all-time toggle.
- SOW Sent log + win-rate summary.
- Apply brand/design system (white background, logo, Aptos font stack, color tokens).

**Milestone**: owner can log in and see everything the current spreadsheet shows, correctly, plus
the Collected vs. Committed distinction and multi-year comparisons — no data entry required yet
beyond the initial import.

## Phase 2 — Structured Intake & Editing
- New Project intake form (client, type, scope tags, state, contract signed date + value,
  referral source, subcontractor assignment, milestone schedule from template).
- Edit-project flow, including milestone status/payment updates.
- Editable project timeline (start/target/actual completion dates, milestone markers on the bar).
- Scope tag backfill workflow for existing/active projects (owner can tag a project without
  re-entering everything else).

**Milestone**: all new business goes through the tool, not the spreadsheet. Historical scope
tagging can happen gradually without blocking anything.

## Phase 3 — Financial Planning Features
- Tax set-aside tracker (quarterly, cash-basis from milestone payments).
- Pipeline-weighted forecast (editable stage probabilities, blended forecast number).
- Commercial milestone structure — once the owner defines it (possibly quarterly-based), encode
  as a `milestone_templates` entry the same way Residential/Furniture are handled.

## Phase 4 — Geography & Subcontractor Depth
- State field capture (backfill-friendly) + state breakdown view.
- Subcontractor-project linkage view (who's on what).
- (If pursued) Subcontractor weekly hour-logging — separate lightweight login, limited to their
  own hours against their assigned projects.

## Ongoing / Not Scheduled
- Client-facing portal, file storage, task management — explicitly out of scope per PRD section 7,
  revisit only if a real need emerges.
