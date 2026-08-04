import type { ProjectTypeName, SubcontractorRates } from "./types";

export function effectiveRate(rates: SubcontractorRates | undefined, projectType: string): number | null {
  if (!rates) return null;
  const typeRate = rates.typeRates[projectType as ProjectTypeName];
  return typeRate ?? rates.defaultHourlyRate ?? null;
}
