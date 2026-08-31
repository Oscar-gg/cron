# cron

Register HTTP calls (any method) with their own headers, body, and a cadence, and let them run
automatically once a day via Vercel Cron. Built on the [T3 Stack](https://create.t3.gg/)
(Next.js App Router, tRPC, Prisma, NextAuth, Tailwind) with Postgres.

## How it works

- Any signed-in user (Google OAuth) can register a call: name, method, URL, headers, body, and a
  cadence in days (minimum 1 — Vercel's Hobby plan only invokes cron jobs once a day).
- New calls from non-admins are saved **disabled**. Admins see them under a "Pending review"
  section on `/admin` and decide whether to enable or delete them.
- A single Vercel Cron job hits `GET /api/cron` once a day. It runs every **enabled** call whose
  cadence has elapsed since its last run, executes the HTTP request server-side, and stores the
  result.
- Each call keeps only its `MAX_RESPONSES_PER_CALL` most recent responses (older ones are pruned
  automatically).
- Owners can edit their own call only while it's disabled (i.e. not yet approved); once an admin
  enables it, only an admin can edit it further. Admins can always edit or delete any call.
  Owners can delete their own call at any time.
- The "Test request" button executes the current form values immediately (nothing is saved) so
  you can check the response before saving or updating a call.
- Outbound requests are guarded against SSRF: only `http`/`https` URLs resolving to public IP
  addresses are allowed (see `src/server/http-exec.ts`).

## Environment variables

See `.env.example`. Notably:

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth credentials. Create them at the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials); set the authorized
  redirect URI to `<your-app-url>/api/auth/callback/google`. Placeholders are set for local dev.
- `ADMIN_EMAILS` — comma-separated list of emails that get admin privileges.
- `MAX_RESPONSES_PER_CALL` — how many recent responses to keep per call (default `5`).
- `CRON_SECRET` — shared secret. Set the same value as a Vercel project env var named
  `CRON_SECRET`; Vercel automatically sends it as `Authorization: Bearer <value>` when invoking
  Cron Jobs, and `/api/cron` rejects any request without a matching header.

## Local development

```bash
npm install
./start-database.sh   # spins up a local Postgres in Docker/Podman
npm run db:push
npm run dev
```

## Deploying

Deploy to Vercel as usual. `vercel.json` already declares the daily cron job:

```json
{ "crons": [{ "path": "/api/cron", "schedule": "0 13 * * *" }] }
```

Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`,
`MAX_RESPONSES_PER_CALL`, and `CRON_SECRET` as project environment variables in Vercel, then run
`npm run db:push` (or set up migrations) against your production database.
