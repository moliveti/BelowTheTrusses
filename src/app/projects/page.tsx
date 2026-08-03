import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getMyRole } from "@/lib/profile";
import { getProjectsIndex } from "@/lib/projects/queries";
import { ProjectsIndex } from "@/components/projects/ProjectsIndex";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ProjectsPage() {
  const role = await getMyRole();
  if (role === "subcontractor") redirect("/hours");

  const projects = await getProjectsIndex();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="Below the Trusses" width={44} height={44} />
          <div>
            <h1 className="text-lg text-ink">
              Below the <em className="font-normal not-italic text-brand-accent">Trusses</em>
            </h1>
            <p className="text-xs text-ink/60">
              <Link href="/" className="underline underline-offset-2 hover:text-brand-primary">
                Dashboard
              </Link>{" "}
              / Projects
            </p>
          </div>
        </div>
        <SignOutButton />
      </header>
      <ProjectsIndex projects={projects} />
    </main>
  );
}
