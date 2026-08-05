import type { DashboardData, ProjectType, ReferralSource, RevenueRow } from "./types";
import {
  PROJECT_TYPES,
  monthlyByTypeForYear,
  monthlyTotalsForYear,
  yearTotal,
  yearlyTotalsByType,
  yoyDeltaPct,
} from "./aggregate";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface YoyInsightFacts {
  currentYear: number;
  priorYear: number;
  currentYearTotal: number;
  priorYearTotal: number;
  yoyDeltaPct: number | null;
  categoryTrends: { type: ProjectType; currentTotal: number; priorTotal: number; deltaPct: number | null }[];
  biggestSwing: {
    month: string;
    currentAmount: number;
    priorAmount: number;
    deltaAbs: number;
    topReferral: { name: string; amount: number } | null;
  } | null;
  biggestForecastMonth: { month: string; amount: number; topCategory: ProjectType | null } | null;
}

function monthlyReferralAmounts(rows: RevenueRow[], year: number, month: number, referralSources: ReferralSource[]) {
  const nameById = new Map(referralSources.map((r) => [r.id, r.name]));
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.year !== year || r.month !== month || !r.referralSourceId) continue;
    const name = nameById.get(r.referralSourceId) ?? "Unknown";
    totals.set(name, (totals.get(name) ?? 0) + r.amount);
  }
  return Array.from(totals.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** All deterministic, computed straight from the data — nothing here is inferred or guessed. */
export function computeYoyInsightFacts(data: DashboardData, currentYear: number): YoyInsightFacts {
  const priorYear = currentYear - 1;
  const combined = [...data.collected, ...data.forecast];

  const currentYearTotal = yearTotal(combined, currentYear);
  const priorYearTotal = yearTotal(combined, priorYear);

  const categoryTrends = PROJECT_TYPES.map((type) => {
    const currentTotals = yearlyTotalsByType(combined, currentYear);
    const priorTotals = yearlyTotalsByType(combined, priorYear);
    return {
      type,
      currentTotal: currentTotals[type],
      priorTotal: priorTotals[type],
      deltaPct: yoyDeltaPct(currentTotals[type], priorTotals[type]),
    };
  });

  const currentMonthly = monthlyTotalsForYear(combined, currentYear);
  const priorMonthly = monthlyTotalsForYear(combined, priorYear);

  let biggestSwing: YoyInsightFacts["biggestSwing"] = null;
  let maxAbsDelta = 0;
  for (let i = 0; i < 12; i++) {
    const delta = currentMonthly[i] - priorMonthly[i];
    if (Math.abs(delta) > maxAbsDelta && (currentMonthly[i] > 0 || priorMonthly[i] > 0)) {
      maxAbsDelta = Math.abs(delta);
      const topReferral = monthlyReferralAmounts(combined, currentYear, i + 1, data.referralSources)[0] ?? null;
      biggestSwing = {
        month: MONTH_NAMES[i],
        currentAmount: currentMonthly[i],
        priorAmount: priorMonthly[i],
        deltaAbs: delta,
        topReferral,
      };
    }
  }

  const forecastMonthly = monthlyTotalsForYear(data.forecast, currentYear);
  const forecastByType = monthlyByTypeForYear(data.forecast, currentYear);
  let biggestForecastMonth: YoyInsightFacts["biggestForecastMonth"] = null;
  let maxForecast = 0;
  for (let i = 0; i < 12; i++) {
    if (forecastMonthly[i] > maxForecast) {
      maxForecast = forecastMonthly[i];
      let topCategory: ProjectType | null = null;
      let topCategoryAmount = 0;
      for (const type of PROJECT_TYPES) {
        if (forecastByType[type][i] > topCategoryAmount) {
          topCategoryAmount = forecastByType[type][i];
          topCategory = type;
        }
      }
      biggestForecastMonth = { month: MONTH_NAMES[i], amount: forecastMonthly[i], topCategory };
    }
  }

  return {
    currentYear,
    priorYear,
    currentYearTotal,
    priorYearTotal,
    yoyDeltaPct: yoyDeltaPct(currentYearTotal, priorYearTotal),
    categoryTrends,
    biggestSwing,
    biggestForecastMonth,
  };
}
