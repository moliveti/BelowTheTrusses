export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday-start work week.
export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}`;
}
