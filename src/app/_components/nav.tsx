import Link from "next/link";

import { auth } from "~/server/auth";

export async function Nav() {
  const session = await auth();

  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          cron
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {session?.user && (
            <>
              <Link href="/calls" className="hover:text-white/80">
                My calls
              </Link>
              {session.user.isAdmin && (
                <Link href="/admin" className="hover:text-white/80">
                  Admin
                </Link>
              )}
              <span className="text-neutral-400">
                {session.user.name ?? session.user.email}
                {session.user.isAdmin && (
                  <span className="ml-1 rounded bg-purple-900/60 px-1.5 py-0.5 text-xs text-purple-200">
                    admin
                  </span>
                )}
              </span>
            </>
          )}
          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-full bg-white/10 px-4 py-1.5 font-medium no-underline transition hover:bg-white/20"
          >
            {session ? "Sign out" : "Sign in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
