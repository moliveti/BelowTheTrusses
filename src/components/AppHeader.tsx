import Image from "next/image";
import { SignOutButton } from "./SignOutButton";

/**
 * Shared across every page — sticky so it stays visible while a long page
 * scrolls. Sized to stay within roughly two sidebar nav rows' height (~76px)
 * so the header doesn't eat vertical real estate the sidebar already proves
 * is unnecessary to spend. `breadcrumb` is for sub-pages (e.g. project
 * detail) that need a bit of context under the identity block.
 */
export function AppHeader({ userEmail, breadcrumb }: { userEmail: string | undefined; breadcrumb?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas px-6 py-2 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div>
          <Image src="/logo.png" alt="Below the Trusses" width={103} height={56} className="h-14 w-auto" />
          {breadcrumb}
        </div>
        <div className="text-right">
          {userEmail && <p className="mb-1.5 text-xs text-ink/60">{userEmail}</p>}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
