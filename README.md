# app-analytics-mxf

Personal meta-dashboard: tracks every personal app I run across Supabase projects, calculates usage share, and emails me a weekly digest.

## Stack
- Next.js 16 (App Router) on Vercel
- Supabase (`personal-mxf` project) for storage
- Anthropic API for summaries + per-app recommendations
- Resend for the weekly email
- Vercel Cron for the Saturday 9am EST trigger

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — `https://vabsoagduzrhomdmkxzc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `WEEKLY_SUMMARY_EMAIL=michaelxuefan@gmail.com`
   - `CRON_SECRET` — strong random; required on the cron endpoint

3. **Schema** — already applied to `personal-mxf`. To re-apply locally, run `supabase/0001_init.sql`.

4. **Seed apps** — already seeded via Supabase. To re-seed:
   ```bash
   npm run seed
   ```

5. **Dev**
   ```bash
   npm run dev
   ```

## Pages
- `/` — executive summary + portfolio table
- `/apps/[slug]` — per-app detail with AI recommendation
- `/weekly` — live + last-saved weekly view
- `/integrate` — copy-paste tracking snippet

## Tracking from other apps

Drop this into any of your other apps:

```ts
const ANALYTICS_URL =
  process.env.NEXT_PUBLIC_APP_ANALYTICS_URL ||
  "https://app-analytics-mxf.vercel.app";

export async function trackAppEvent(input: {
  app_slug: string;
  event_name: string;
  event_type?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}) {
  try {
    await fetch(`${ANALYTICS_URL}/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {}
}

trackAppEvent({
  app_slug: "finance-mxf",
  event_name: "app_opened",
  event_type: "usage",
  metadata: {},
});
```

The `app_slug` must match a row in `apps` — add it via Supabase or extend the seed.

### Standard event taxonomy
`app_opened`, `page_viewed`, `report_viewed`, `recommendation_generated`, `recommendation_accepted`, `recommendation_ignored`, `email_sent`, `task_created`, `decision_logged`, `feedback_submitted`.

## Weekly cron

- Endpoint: `GET /api/cron/weekly-summary`
- Auth: header `Authorization: Bearer $CRON_SECRET` or `?secret=` query param
- Vercel cron: `0 13,14 * * 6` (covers EST + EDT 9am)
- The endpoint reads current Toronto time and only sends if it is Saturday 9am America/Toronto; it also de-dupes per `week_start`.
- To force a send: `GET /api/cron/weekly-summary?force=1` with the secret.

## API
`POST /api/track`

```json
{
  "app_slug": "finance-mxf",
  "event_name": "app_opened",
  "event_type": "usage",
  "metadata": { "page": "/dashboard" },
  "occurred_at": "2026-05-13T14:00:00Z"
}
```

Returns `{ ok: true }` or a 4xx with `error`.

## Security
- Service role key is server-only; never imported into client components.
- `/api/cron/*` is gated by `CRON_SECRET`.
- `/api/track` does input validation and rejects unknown `app_slug`s.

## Deploy
1. Push to GitHub.
2. Import on Vercel; add the env vars (including `CRON_SECRET`).
3. Vercel picks up `vercel.json` cron automatically.
