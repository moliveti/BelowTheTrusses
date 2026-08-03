import Image from "next/image";
import { getMyAssignedProjects, getMySubcontractorProfile, getMyTimeEntries } from "@/lib/hours/queries";
import { HoursEntry } from "@/components/hours/HoursEntry";
import { SignOutButton } from "@/components/SignOutButton";

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

  const [projects, entries] = await Promise.all([
    getMyAssignedProjects(),
    getMyTimeEntries(subcontractor.id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
          <div>
            <h1 className="text-lg text-ink">
              Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
            </h1>
            <p className="text-xs text-ink/60">Contracted Work — Hours Log</p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <HoursEntry subcontractor={subcontractor} projects={projects} initialEntries={entries} />
    </main>
  );
}
