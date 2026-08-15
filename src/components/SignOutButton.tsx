"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ iconOnly }: { iconOnly?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <button onClick={handleSignOut} title="Sign out" className="flex w-full items-center justify-center py-1 text-ink/50 hover:text-ink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="font-mono text-xs uppercase tracking-wide text-ink/50 underline underline-offset-2 hover:text-ink"
    >
      Sign out
    </button>
  );
}
