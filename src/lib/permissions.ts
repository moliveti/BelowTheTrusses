import type { Role } from "@/lib/profile";

// Quote/contract generation is restricted to the owner tier (today: Amy +
// Mariano, the only two 'owner' profiles) — named separately from a bare
// role check so intent reads clearly at call sites and this is a one-line
// change if a narrower allowlist is ever needed. Kept out of profile.ts
// (server-only, imports next/headers) so client components can import this
// pure check without pulling in server code.
export function canBuildQuotes(role: Role | null): boolean {
  return role === "owner";
}
