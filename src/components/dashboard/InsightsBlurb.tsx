"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "ready" | "unavailable" | "error";

export function InsightsBlurb() {
  const [status, setStatus] = useState<Status>("loading");
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch("/api/insights")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 503) {
          setStatus("unavailable");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        setText(data.text ?? "");
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "unavailable") return null;

  return (
    <div className="mb-12 border-l-2 border-brand-accent bg-surface px-4 py-3">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink/40">What&rsquo;s Driving This</div>
      {status === "loading" && <p className="text-sm text-ink/40">Analyzing year-over-year trends…</p>}
      {status === "error" && <p className="text-sm text-ink/40">Couldn&rsquo;t generate insights right now.</p>}
      {status === "ready" && <p className="text-sm text-ink/80">{text}</p>}
    </div>
  );
}
