"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFieldStatus } from "@/hooks/useFieldStatus";
import { FieldStatusBadge } from "@/components/FieldStatusBadge";

const STATUS_KEY = "name";

export function ProjectNameEditor({ projectId, initialName }: { projectId: string; initialName: string }) {
  const router = useRouter();
  const { status, error, run } = useFieldStatus();
  const [savedName, setSavedName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);

  // Picks up a rename made elsewhere (e.g. while generating the contract).
  useEffect(() => {
    setSavedName(initialName);
    setDraft(initialName);
  }, [initialName]);

  const next = draft.trim();
  const dirty = next !== "" && next !== savedName;
  const saving = status[STATUS_KEY] === "saving";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    const ok = await run(STATUS_KEY, async () => {
      const { data, error: updateError } = await createClient()
        .from("projects")
        .update({ name: next })
        .eq("id", projectId)
        .select("id");
      if (updateError) {
        return {
          error: updateError.code === "23505" ? "This client already has a project with that name." : updateError.message,
        };
      }
      if (!data || data.length === 0) return { error: "Couldn't save — you may not have permission." };
      return { error: null };
    });
    if (ok) {
      setSavedName(next);
      setDraft(next);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Project name"
        maxLength={120}
        className="min-w-[14rem] border border-transparent bg-transparent px-1 py-0.5 text-xl text-ink hover:border-line focus:border-brand-primary focus:bg-surface focus:outline-none"
      />
      {dirty && (
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-primary px-3 py-1.5 font-mono text-[11px] uppercase text-white hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Name"}
        </button>
      )}
      <FieldStatusBadge status={status[STATUS_KEY]} error={error[STATUS_KEY]} />
    </form>
  );
}
