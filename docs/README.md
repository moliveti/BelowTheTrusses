# Below the Trusses — Forecast & Business Intelligence Tool
### Spec Package for Build (v1.0)

This folder is the handoff package for building the hosted version of the Below the Trusses
forecasting tool. It replaces `2025_BTT_Forecast.xlsx` as the system of record.

## Contents

| File | Purpose |
|---|---|
| `01_PRD.md` | What we're building and why — features, users, success criteria |
| `02_DATA_MODEL.md` | Database schema (Postgres/Supabase), ERD, field definitions, migration mapping from the Excel file |
| `03_DESIGN_SYSTEM.md` | Brand tokens, typography, color, logo usage, component behavior |
| `04_ROADMAP.md` | Phased build plan |
| `reference/BTT_Forecast_Dashboard_Prototype.html` | Working front-end prototype (static, sample data) — use as the visual/interaction reference for Phase 1 |
| `reference/2025_BTT_Forecast.xlsx` | Source data file — will be migrated into the database, not used at runtime |
| `reference/logo.png` | Company logo (truss mark) |

## Quick Context

- **Company**: Below the Trusses — interior design firm, Jacksonville, FL. Residential + commercial
  design, plus furniture resale commissions. ~20 years in business. Serves Florida and Georgia.
  (https://www.belowthetrusses.com)
- **Users**: The owner, and Amy Oliveti. Subcontractors may get limited access in a later phase to log hours.
- **Stack decisions already made**: Next.js (or similar) hosted on **Vercel**, **Supabase** (Postgres + Auth) for
  the database, white background UI, `Aptos` font with system fallback.
- **Core principle**: this is a forecasting and business-intelligence tool first, not a project-management
  tool — it should stay lightweight to use, while capturing enough structured data (dates, milestones,
  scope, subcontractors, referrals) to power real analytics.
- **Data status**: the current Excel data is being cleaned up and is not final. Build the schema and
  import tooling so re-imports are easy and non-destructive (upsert by a stable project key, not a
  destructive overwrite).

## Non-negotiables carried over from the working sessions

1. Track **both** the contract-signed date (→ forecasted/committed business) and money-due dates
   (via milestones) — these are different things and the old sheet only had the latter.
2. Every project should eventually capture: **Type** (Residential/Commercial/Furniture), **Scope**
   (kitchen, bath, full remodel, etc.), **State**, **Subcontractor(s)**, **Referral source**, and
   **Milestones** (name, due date, amount, paid status).
3. Income tax: 30% on all service income, 0% on furniture commission income. Paid quarterly —
   the tool should maintain a running tax set-aside estimate.
4. Historical "did not materialize" business (SOW Sent but not won) is tracked for win-rate and
   YoY context, separately from won business.
