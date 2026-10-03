export function BurndownBar({ logged, allocated }: { logged: number; allocated: number | null }) {
  if (allocated === null) {
    return <div className="font-mono text-[10.5px] text-ink/40">{logged.toFixed(1)} hrs logged · no allocation set</div>;
  }
  const pct = allocated > 0 ? Math.min(100, (logged / allocated) * 100) : 100;
  const over = logged > allocated;
  const remaining = allocated - logged;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-40 max-w-[40vw] overflow-hidden bg-line">
        <div className={`h-full ${over ? "bg-warning" : "bg-brand-accent"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono text-[10.5px] ${over ? "text-warning" : "text-ink/50"}`}>
        {logged.toFixed(1)} / {allocated.toFixed(1)} hrs
        {over ? ` · ${Math.abs(remaining).toFixed(1)} over` : ` · ${remaining.toFixed(1)} left`}
      </span>
    </div>
  );
}
