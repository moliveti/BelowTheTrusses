"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.replace("/");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      router.replace("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm border border-line bg-surface p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Below the Trusses" width={56} height={56} />
          <h1 className="text-lg text-ink">Below the Trusses</h1>
          <p className="text-center text-xs text-ink/60">Forecast &amp; Business Intelligence</p>
        </div>

        <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wide text-ink/60" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
            placeholder="you@belowthetrusses.com"
          />
          <label className="text-xs uppercase tracking-wide text-ink/60" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-line px-3 py-2 text-sm outline-none focus:border-brand-primary"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-2 bg-brand-primary py-2 text-sm text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
          >
            {status === "sending" ? "Signing in…" : "Sign in"}
          </button>
          {status === "error" && <p className="text-xs text-warning">{error}</p>}
        </form>
      </div>
    </main>
  );
}
