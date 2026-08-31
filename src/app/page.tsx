import Link from "next/link";

import { auth } from "~/server/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">cron</h1>
      <p className="max-w-xl text-neutral-400">
        Register HTTP calls with their own headers, body, and method. Enabled
        calls run automatically once a day via Vercel Cron, on the cadence you
        choose (minimum once per day). Every call keeps its most recent
        responses so you can check on it later.
      </p>

      {session?.user ? (
        <div className="flex gap-3">
          <Link
            href="/calls"
            className="w-fit rounded bg-purple-700 px-4 py-2 text-sm font-medium hover:bg-purple-600"
          >
            My calls
          </Link>
          {session.user.isAdmin && (
            <Link
              href="/admin"
              className="w-fit rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Admin dashboard
            </Link>
          )}
        </div>
      ) : (
        <Link
          href="/api/auth/signin"
          className="w-fit rounded bg-purple-700 px-4 py-2 text-sm font-medium hover:bg-purple-600"
        >
          Sign in with Google
        </Link>
      )}
    </div>
  );
}
