import Image from "next/image";
import { getMyAssignedProjects, getMySubcontractorProfile, getMyTimeEntries } from "@/lib/hours/queries";
import { HoursEntry } from "@/components/hours/HoursEntry";
import { SignOutButton } from "@/components/SignOutButton";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";

export default async function HoursPage() {
  const subcontractor = await getMySubcontractorProfile();

  if (!subcontractor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="max-w-sm border border-line bg-surface p-8 text-center">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} className="mx-auto mb-4" />
          <p className="mb-4 text-sm text-ink/70">
            Your account isn&apos;t linked to a subcontractor profile yet. Contact the owner to get set up.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [projects, entries] = await Promise.all([
    getMyAssignedProjects(),
    getMyTimeEntries(subcontractor.id),
  ]);

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <main className="px-6 py-10 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-baseline justify-between border-b-[1.5px] border-ink pb-2">
            <h2 className="text-lg font-normal">Hours</h2>
            <span className="font-mono text-[10.5px] uppercase tracking-wide text-ink/50">Contracted Work Log</span>
          </div>
          <HoursEntry subcontractor={subcontractor} projects={projects} initialEntries={entries} />
        </div>
      </main>
    </>
  );
}
