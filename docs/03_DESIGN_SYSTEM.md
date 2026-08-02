# Design System — Below the Trusses

## Direction

The working prototype used a "blueprint/drafting" aesthetic (navy header, graph-paper background,
brass accent) to nod at "Trusses" as a construction/architecture term. **The owner wants a white
background** for the production build — carry over the brass accent and the truss/structural
motif, but on a light, clean canvas rather than the dark blueprint header. Think: a well-lit
architecture studio, not a construction blueprint.

## Brand Assets

- Logo: `reference/logo.png` — a line-drawing of a wood roof truss. Works well as a favicon,
  header mark, and as a subtle background/divider motif (e.g., the diagonal truss lines echoed in
  section dividers or loading states) — use sparingly, it's a signature element, not a repeating
  pattern.

## Typography

- **Primary font**: `Aptos` with system fallback stack:
  `font-family: Aptos, Calibri, "Segoe UI", -apple-system, sans-serif;`
  Renders as true Aptos for users with Windows/Microsoft 365 fonts installed; falls back
  gracefully otherwise. No web font license needed since we're not self-hosting the font file.
- Establish a clear type scale (e.g., 12 / 13 / 15 / 19 / 26 / 34px) — reuse for headers, labels,
  KPI values, and data-table text consistently across views.
- Numbers/data (dollar figures, dates, table cells) can use a monospace or tabular-figure style
  for alignment — the prototype used a mono font for this; keep that convention even on a white
  background, it helps large tables of dollar amounts stay scannable.

## Color

White background (`#FFFFFF` or a very light off-white, e.g. `#FAFAF8`) as the base. Suggested
palette, refined from the prototype's blueprint/brass pairing:

| Token | Approx. Hex | Use |
|---|---|---|
| `--ink` | `#1C2430` | primary text |
| `--surface` | `#FFFFFF` | page/card background |
| `--line` | `#E4E1D8` or similar light neutral | table borders, dividers |
| `--brand-primary` | deep navy/blueprint blue, `#1E3A5F` | primary accent — headers, primary chart series, active states |
| `--brand-accent` | brass/warm gold, `#B8894A` | highlight accent — used sparingly (as in the prototype's KPI top-border, referral bars) |
| `--positive` | muted green | YoY up, paid status |
| `--warning` | terracotta/rust | overdue, lost pipeline, tax-reserve alerts |

Exact hex values are a starting point — worth a quick pass against the logo once it's placed on
white, to make sure the brass reads clearly (it may need to shift slightly warmer or darker on a
white background than it did on navy).

## Component Notes (carried from prototype, refined per feedback)

- **KPI row**: keep the card style (thin accent border, label + value + delta), sits above the
  YoY chart. Add a toggle control (Collected vs. Committed) that affects both the KPI row and the
  chart below it together, not independently.
- **YoY revenue chart**: line/area chart, one series per year. Add the Collected/Committed toggle
  (see PRD 5.2). Keep year-over-year color consistency (e.g., current year always gets the accent
  color, prior years get neutral tones) across all charts, not just this one.
- **Monthly breakdown table**: keep the type-coded row labels. Upgrade interaction: default view
  is single year by month (as built), but add a way to pin 2+ years side-by-side for direct
  comparison — e.g., a "Compare years" toggle that reshapes the table to Year × Month columns
  instead of Type × Month.
- **Referral list**: keep the horizontal bar-list style for lifetime totals; add a per-referrer
  year breakdown (expandable row, small multi-year bar, or a secondary table) — owner specifically
  asked to see referral trends by year, not just lifetime totals.
- **Business mix donut**: add a control for YTD / a specific prior year / All-time — same
  component, different data slice, not three separate charts.
- **Timeline/Gantt**: becomes an editable component, not just a display. Each bar should support:
  click to open the project's milestones, drag or form-edit to adjust start/target completion
  dates, and visual markers on the bar for each milestone due date (not just a solid block).
- **SOW Sent table**: add a small win-rate summary strip above the table (win rate %, average
  won vs. lost fee) rather than just the raw log.
- **Tax set-aside panel** (new): quarterly cards or a small table — taxable collected, reserve
  owed, cumulative reserve. Should visually read as "informational/planning," not as an alert
  panel, unless a quarter is close to a filing deadline.

## Layout

- Keep the overall single-column, section-by-section layout from the prototype (KPIs → YoY chart
  → breakdown table → referrals/mix side-by-side → timeline → SOW log → tax panel) — it read well
  and matches how the owner talked through the data.
- Responsive down to tablet width at minimum; the primary usage is likely desktop, but shouldn't
  break on a smaller screen.
