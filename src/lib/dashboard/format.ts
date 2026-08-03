export function fmtUsd(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function fmtUsdCompact(n: number): string {
  if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "k";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
