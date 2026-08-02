# PRD — Below the Trusses Forecast & BI Tool

## 1. Purpose

Replace the Excel-based forecast tracker with a hosted web app that gives the owner a real-time,
accurate view of historical performance, committed business, and pipeline — with enough structure
to support tax planning, subcontractor coordination, and referral tracking as the business grows.

## 2. Users & Access

| Role | Access |
|---|---|
| Owner | Full access — all data, all clients, all financials |
| Amy Oliveti | Full access (same as owner, for now) |
| Subcontractors (future phase) | Limited — see only their assigned projects, log weekly hours. No financial visibility beyond their own hours. |

Auth via Supabase Auth (email/password or magic link). No public sign-up — users are invited by the owner.

## 3. Core Data Objects

See `02_DATA_MODEL.md` for full schema. Conceptually:

- **Client** — a person or company. Can have multiple **Projects** over time.
- **Project** — one engagement (e.g., a specific remodel, a commercial buildout). Has a Type,
  Scope, State, referral source, contract details, subcontractors, and milestones.
- **Milestone** — a billing/payment event within a project (deposit, design phase, install, final,
  etc.). This is how money is actually collected and dated — the monthly "revenue" numbers in the
  dashboard are built by aggregating milestone paid amounts by paid date.
- **SOW Sent (Lost Pipeline)** — proposals sent that did not (yet) convert. Tracked for win-rate
  and historical YoY context, not counted as revenue.
- **Subcontractor** — Mariano Oliveti (commercial), Rachel Roberts (plans/finishes), Lee Mccoy
  (plans/renderings), Rusty Ragsdale (architect), and any future additions.
- **Referral Source** — normalized entity for who referred a client (past client, realtor, vendor,
  other), replacing the current "(Name)" parsing convention.

## 4. Key Concepts to Get Right

### 4.1 Two distinct timelines per project
- **Committed date** = when the contract/SOW was signed. This is what drives the *forecast* and
  "business committed" views — it answers "how much business did we book, and when."
- **Payment/due dates** = when money is actually due and collected, driven by milestones. This is
  what drives *cash flow* and the historical "actuals" views.

Both must be capturable at intake and both must be independently reportable. The current sheet
only had the second one (monthly $ = when money showed up).

### 4.2 Milestones
- Residential and Furniture projects mostly follow a standard sequence (confirmed with owner) —
  the tool should support **milestone templates** that auto-populate at intake and can be edited
  per project.
- Furniture is close to immediate payment (effectively a single milestone).
- Commercial payment terms are longer and not yet standardized — support fully custom milestones
  for commercial projects for now, with room to define a standard (possibly quarterly-based)
  template later without a schema change.
- Each milestone has: name, sequence, due date, amount, and paid status/date/amount (amount due
  and amount paid can differ slightly — partial payments happen).

### 4.3 Pipeline-weighted forecast
Projects move through stages, each with a default probability weight:

| Stage | Default probability |
|---|---|
| Lead | 10% |
| SOW Sent | 25% |
| Verbal commitment | 60% |
| Contract signed | 100% |
| Lost/declined | 0% (excluded from pipeline, kept for win-rate history) |

Forecast views should be able to show both "committed only" (100% stage) and
"probability-weighted" totals (sum of contract value × stage probability) so the owner can see a
conservative vs. optimistic pipeline number. Stage probabilities should be editable in a settings
table, not hardcoded.

### 4.4 Tax set-aside tracker
- Service income (Residential + Commercial project revenue) is taxed at 30%.
- Furniture commission income is not taxed.
- Taxes are paid quarterly.
- The tool should show, per quarter: taxable income collected, tax reserve owed (30% of taxable
  portion), and running/cumulative reserve — based on actual **collected** milestone payments
  (cash basis), not committed contract value.

### 4.5 Win-rate (from SOW Sent)
- Track proposals sent vs. converted vs. lost/no-response, by period.
- Win rate = converted / (converted + lost/no-response), excluding still-open proposals.
- Average proposed fee for won vs. lost, to spot pricing/fit patterns.
- When a SOW converts, it should link to the resulting Project record rather than being duplicated.

### 4.6 Referral tracking
- Every project can have a referral source (nullable).
- Referral source has a type (Past Client / Realtor / Vendor / Other) and a name.
- Views needed: lifetime totals by referrer (already in prototype), **plus year-by-year
  breakdown per referrer** (requested), so the owner can see whether a referral relationship is
  active or historical.

### 4.7 Scope tags (residential only)
- Multi-select tag field on Residential projects, **each tag carries its own dollar amount** —
  this isn't just a label, it's a breakdown of where a project's value comes from:
  Furniture and Accessories, Covered Porch, Sunroom, Backyard Design, Kitchen Remodel, Bathroom
  Remodel, Exterior Finishes, Interior Finishes.
- Confirmed with owner: **scope tracking applies to Residential projects only** — not Commercial,
  not Furniture (the resale business line).
- Not required at intake — backfill-friendly. Views should have an explicit "Not tagged yet"
  bucket rather than excluding untagged projects.
- "Furniture and Accessories" as a scope tag (part of a residential project's fixed fee) is a
  different thing from the `Furniture` project **type** (commission-based resale) — don't merge
  these in reporting, they're different revenue mechanics (see 4.8).

### 4.8 Billing structure & rates

Confirmed pricing model, one method per business type:

| Type | Method | Rate |
|---|---|---|
| Commercial | Hourly | $120/hr |
| Residential | Fixed fee (typical) | Flat project fee, **plus $200/hr for any add-on hours** the client requests beyond the originally contracted scope |
| Residential | Hourly (alternative) | $200/hr |
| Furniture | Commission | Variable — typically ~30% of the sale, but negotiated deal-by-deal. **Must be entered/confirmed per project, not silently defaulted.** |

Key implications for the schema and UI:
- Rates should live in an editable **settings table**, not be hardcoded, and get **snapshotted
  onto each project at intake** — so a future rate change doesn't retroactively alter historical
  or already-signed projects.
- **Add-on services are hourly, not a flat per-item fee**: when a client asks for work beyond the
  original contracted scope, it's billed at $200/hr for however many extra hours that takes.
  Intake/edit UI needs an "add-on hours" field (not a flat count), and the fee is
  `addon_hours × $200`.
- **Furniture commission rate is not a reliable default** — it varies deal to deal (~30% typical).
  The intake form should require the owner to enter or confirm the actual rate for that specific
  deal rather than silently applying 30%. Track it for reference, but don't assume it.
- **Important — furniture revenue needs no calculation.** The dollar amounts already recorded for
  Furniture-type entries (in the historical sheet, and going forward via milestones) **are the
  commission already paid to Below the Trusses** — not a gross sale total that needs a 30% math
  step applied. Do not multiply anything to derive furniture revenue; the recorded amount *is*
  the revenue. A gross sale total / commission rate can optionally be captured for the owner's
  own reference/analysis, but neither feeds into any revenue or tax calculation.

## 5. Dashboard Views (v1 scope)

All views below already exist in prototype form (`reference/BTT_Forecast_Dashboard_Prototype.html`)
except where marked **[NEW]**.

1. **KPI row** — FY actual totals, YoY deltas, referral-sourced lifetime total. Should be able to
   toggle between "Collected" (cash/milestone basis) and "Committed" (contract-signed basis) **[NEW toggle]**.
2. **YoY revenue chart** — monthly line/area chart across years. Add a toggle: **Collected vs.
   Committed** **[NEW]**, since these tell different stories (when work was booked vs. when cash
   arrived).
3. **Monthly breakdown table** — by Type (Residential/Commercial/Furniture) with year selector.
   Upgrade to a **dynamic comparison table [NEW]**: allow viewing a single year by month, or
   multiple years side-by-side by month for direct comparison, without needing separate tables per year.
4. **Referral sources** — bar list of lifetime totals (existing), **plus a year-over-year
   breakdown per referrer [NEW]** (e.g., small sparkline or a per-referrer year table).
5. **Business mix** — donut chart by Type. Add toggles **[NEW]**: Year-to-date, any individual
   prior year, and **all-time since inception**.
6. **Project timeline (Gantt)** — visual timeline of active projects. Needs to become
   **editable at intake and after [NEW]**: enter/adjust start date, target completion date, and
   milestone markers on the bar itself (not just inferred from billing months).
7. **SOW Sent / lost business log** — table of proposals not converted, with win-rate summary
   **[NEW]**.
8. **Tax set-aside tracker [NEW]** — quarterly reserve view per section 4.4.
9. **Pipeline-weighted forecast [NEW]** — blended forecast number per section 4.3.
10. **State breakdown [NEW, later phase]** — revenue/project count by state, once state is
    captured going forward.
11. **Subcontractor view [NEW, later phase]** — projects and (eventually) hours by subcontractor.
12. **Residential scope breakdown [NEW, later phase]** — revenue by scope category (Kitchen,
    Bath, Sunroom, etc.) across residential projects, once scope amounts are captured. Include a
    "not yet tagged" bucket so early data isn't misleading.

## 6. Intake Flow (new capability)

A structured "New Project" form replacing ad-hoc spreadsheet rows. Captures:
- Client (existing or new)
- Type, Scope tag(s), State
- Contract signed date + contract value → auto-creates forecast entry
- Referral source (optional)
- Subcontractor(s) assigned (optional)
- Milestone schedule — pre-filled from template by Type, editable
- Start date / target completion date

Editing an existing project should be equally structured (not a raw grid edit), so milestone
status and dates stay reliable.

## 7. Explicit Non-Goals (v1)

- Full project management (task lists, file storage, client portal) — out of scope for now.
- Automated invoicing/payment collection — the tool tracks amounts and dates, it doesn't process
  payments.
- Subcontractor hour-logging — flagged as a likely Phase 2+ feature, not v1.
- Multi-tenant / white-label — this is a single-company internal tool.

## 8. Success Criteria

- Owner can answer "how much have we booked this year vs. last year" and "how much cash is
  actually coming in this quarter" as two different, correct numbers.
- Owner can generate a quarterly tax set-aside figure without manual math.
- Referral and scope data, once captured, requires no spreadsheet gymnastics to report on.
- New project intake takes less time than adding a row to the old spreadsheet, not more.
