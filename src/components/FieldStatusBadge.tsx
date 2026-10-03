import type { FieldStatus } from "@/hooks/useFieldStatus";

export function FieldStatusBadge({ status, error }: { status?: FieldStatus; error?: string }) {
  if (status === "saving") {
    return <span className="ml-1.5 font-mono text-[10px] text-ink/40">Saving…</span>;
  }
  if (status === "saved") {
    return (
      <span className="ml-1.5 font-mono text-[10px] text-positive" title="Saved">
        Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="ml-1.5 font-mono text-[10px] text-warning" title={error ?? "Save failed"}>
        {error ?? "Save failed"}
      </span>
    );
  }
  return null;
}
