"use client";

export function ConfirmDeleteDialog({
  title,
  loading,
  removes,
  keeps,
  blockedReasons,
  blockedIntro = "This can't be deleted because it has:",
  blockedNote = "These are financial records, so they're protected. Remove or move them first if this really is a mistake.",
  confirmLabel,
  busy,
  error,
  doneMessage,
  doneLabel,
  onConfirm,
  onCancel,
  onDone,
}: {
  title: string;
  loading: boolean;
  removes: string[];
  keeps: string[];
  blockedReasons?: string[];
  blockedIntro?: string;
  blockedNote?: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  doneMessage?: string;
  doneLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onDone?: () => void;
}) {
  const blocked = blockedReasons && blockedReasons.length > 0;
  const dismiss = doneMessage ? onDone : busy ? undefined : onCancel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base text-ink">{title}</h3>

        {doneMessage ? (
          <>
            <p className="mb-4 text-sm text-positive">✓ {doneMessage}</p>
            <button
              onClick={onDone}
              className="bg-brand-primary px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90"
            >
              {doneLabel ?? "Close"}
            </button>
          </>
        ) : loading ? (
          <p className="text-sm text-ink/60">Checking what&apos;s linked…</p>
        ) : blocked ? (
          <>
            <p className="mb-2 text-sm text-warning">{blockedIntro}</p>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink/80">
              {blockedReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {blockedNote && <p className="mb-4 text-xs text-ink/60">{blockedNote}</p>}
            <button onClick={onCancel} className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas">
              Close
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-ink/70">This will permanently delete:</p>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink">
              {removes.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {keeps.length > 0 && (
              <>
                <p className="mb-1 text-sm text-ink/70">Will be kept:</p>
                <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink/70">
                  {keeps.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </>
            )}
            <p className="mb-4 text-xs text-warning">This can&apos;t be undone.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={onConfirm}
                disabled={busy}
                className="bg-warning px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-warning/90 disabled:opacity-50"
              >
                {busy ? "Deleting…" : confirmLabel}
              </button>
              <button
                onClick={onCancel}
                disabled={busy}
                className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase text-ink hover:bg-canvas disabled:opacity-50"
              >
                Cancel
              </button>
              {error && <span className="text-xs text-warning">{error}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
