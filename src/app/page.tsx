import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: clientCount }, { count: projectCount }, { count: stageCount }] =
    await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("pipeline_stages").select("*", { count: "exact", head: true }),
    ]);

  const cards = [
    { label: "Clients", value: clientCount ?? 0 },
    { label: "Projects", value: projectCount ?? 0 },
    { label: "Pipeline Stages Configured", value: stageCount ?? 0 },
  ];

  return (
    <main className="mx-auto max-w-5xl px-10 py-16">
      <header className="mb-12 flex items-center gap-4 border-b border-line pb-6">
        <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
        <div>
          <h1 className="text-lg text-ink">
            Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
          </h1>
          <p className="text-xs text-ink/60">Signed in as {user?.email ?? "unknown"}</p>
        </div>
      </header>

      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink/70">
        Phase 0 scaffold — schema is live and the Excel import has run if the counts below are
        non-zero. The full dashboard (KPI row, YoY chart, pipeline forecast, etc.) lands in Phase
        1.
      </p>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-line border-t-2 border-t-brand-accent bg-surface p-5">
            <div className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50">
              {c.label}
            </div>
            <div className="font-mono text-xl text-ink">{c.value}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
