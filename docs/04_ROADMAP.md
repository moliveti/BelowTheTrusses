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
- ~~Subcontractor-project linkage view (who's on what).~~ — **Done ahead of schedule**: built as the
  "Contracted Work" tab, including daily hour-logging (own login, own assigned projects only, no
  financial visibility beyond their own hours), per-assignment rate + allocated-hours capture, and
  cost-by-subcontractor / cost-by-project rollups.

## Backlog Ideas (not yet scheduled)
- **Project intake with hours/pricing forecasting.** A proper "New Project" quoting step that
  estimates hours and price upfront, rather than assigning rates only after work starts. Owner's
  framing (2026-08-03): subcontractor rates should carry a margin (the rate paid to the sub isn't
  the rate billed to the client), and every subcontracted scope needs Amy's own QA/verification
  time factored in — she'd pre-enter how many hours she expects to spend checking a contractor's
  work on that project, alongside the contractor's allocated hours and preloaded rate, so the
  quote/estimate reflects true cost (sub cost + margin + Amy's QA time), not just the sub's rate.
  Ties into the profitability angle below.
- **Profitability reporting.** Once rates + hours + costs are tracked (done) and forecasting exists
  (above), surface actual project margin — revenue vs. (subcontractor cost + Amy's QA time cost) —
  to inform better quoting and subcontracting decisions over time.

## Ongoing / Not Scheduled
- Client-facing portal, file storage, task management — explicitly out of scope per PRD section 7,
  revisit only if a real need emerges.
