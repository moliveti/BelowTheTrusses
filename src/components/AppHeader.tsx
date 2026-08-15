import Image from "next/image";
import { SignOutButton } from "./SignOutButton";

/**
 * Shared across every page — sticky so it stays visible while a long page
 * scrolls. Sized to stay within roughly two sidebar nav rows' height (~76px)
 * so the header doesn't eat vertical real estate the sidebar already proves
 * is unnecessary to spend. `breadcrumb` is for sub-pages (e.g. project
 * detail) that need a bit of context under the identity block.
 */
export function AppHeader({
  userEmail,
  breadcrumb,
  onOpenMobileNav,
}: {
  userEmail: string | undefined;
  breadcrumb?: React.ReactNode;
  onOpenMobileNav?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas px-4 py-2 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onOpenMobileNav && (
            <button
              onClick={onOpenMobileNav}
              className="flex h-8 w-8 shrink-0 items-center justify-center text-ink/60 sm:hidden"
              aria-label="Open navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div>
            <Image src="/logo.png" alt="Below the Trusses" width={103} height={56} className="h-11 w-auto sm:h-14" />
            {breadcrumb}
          </div>
        </div>
        <div className="text-right">
          {userEmail && <p className="mb-1.5 truncate text-[11px] text-ink/60 sm:text-xs">{userEmail}</p>}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
