"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "verifying">("idle");
  const [error, setError] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Supabase's default (non-custom-SMTP) magic-link email redirects here
  // with the session in the URL hash (#access_token=...). The browser
  // client auto-detects and persists it to cookies on load — once that
  // happens, send the user on to the dashboard.
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      setStatus("verifying");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm border border-line bg-surface p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Below the Trusses" width={56} height={56} />
          <h1 className="text-lg text-ink">
            Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
          </h1>
          <p className="text-center text-xs text-ink/60">Forecast &amp; Business Intelligence</p>
        </div>

        {status === "verifying" ? (
          <p className="text-center text-sm text-ink/60">Signing you in…</p>
        ) : status === "sent" ? (
          <p className="text-center text-sm text-positive">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
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
            <button
              type="submit"
              disabled={status === "sending"}
              className="mt-2 bg-brand-primary py-2 text-sm text-white transition hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {status === "error" && <p className="text-xs text-warning">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
