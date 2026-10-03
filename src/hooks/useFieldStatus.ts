"use client";

import { useRef, useState } from "react";

export type FieldStatus = "idle" | "saving" | "saved" | "error";

/** Per-field "Saving…" / "Saved" / error feedback for inline-edit forms, keyed
 * by any string (a column name, or `${id}:${column}` for a table of rows). */
export function useFieldStatus() {
  const [status, setStatus] = useState<Record<string, FieldStatus>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function saving(key: string) {
    clearTimeout(timers.current[key]);
    setStatus((s) => ({ ...s, [key]: "saving" }));
  }

  function saved(key: string) {
    setStatus((s) => ({ ...s, [key]: "saved" }));
    setError((e) => ({ ...e, [key]: "" }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => setStatus((s) => ({ ...s, [key]: "idle" })), 2000);
  }

  function failed(key: string, message: string) {
    setStatus((s) => ({ ...s, [key]: "error" }));
    setError((e) => ({ ...e, [key]: message }));
  }

  /** Wraps an async save call with saving/saved/error bookkeeping. Returns true on success. */
  async function run(key: string, fn: () => Promise<{ error: string | null }>): Promise<boolean> {
    saving(key);
    const result = await fn();
    if (result.error) {
      failed(key, result.error);
      return false;
    }
    saved(key);
    return true;
  }

  return { status, error, saving, saved, failed, run };
}
