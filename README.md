# app-analytics-mxf

Personal meta-dashboard: tracks every personal app I run across Supabase projects, calculates usage share, and emails me a weekly digest.

## Stack
- Next.js 16 (App Router) on Vercel
- Supabase (`personal-mxf` project) for storage; **RLS enabled** on `apps`, `app_usage_events`, `weekly_app_summaries`. Server-side queries use the service role (which bypasses RLS); the anon key is blocked from these tables.
- **Auth gate** via `@supabase/ssr` — the entire dashboard is behind a `/login` page. Public endpoints (`/api/track`, `/api/cron/*`, `/api/posthog/*`, `/api/auth/*`) are gated only by their own secrets.
- Anthropic API for summaries + per-app recommendations
- PostHog for cross-app event capture; events are mirrored here via a webhook destination (`/api/posthog/webhook`)
- Resend for the weekly email
- Vercel Cron for the Saturday 9am EST weekly digest + a one-shot diagnostic email

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — `https://vabsoagduzrhomdmkxzc.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; required — RLS blocks anon, so server code must use this)
   - `ANTHROPIC_API_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `WEEKLY_SUMMARY_EMAIL=michaelxuefan@gmail.com`
   - `CRON_SECRET` — strong random; required on `/api/cron/*` endpoints
   - `POSTHOG_WEBHOOK_SECRET` — required on `/api/posthog/webhook`
   - `NEXT_PUBLIC_POSTHOG_KEY` — PostHog project key (`phc_…`) for the SDK
   - `NEXT_PUBLIC_POSTHOG_HOST` (default `https://us.i.posthog.com`)

3. **Schema** — already applied to `personal-mxf`. To re-apply locally, run `supabase/0001_init.sql`.

4. **Seed apps** — already seeded via Supabase. To re-seed:
   ```bash
   npm run seed
   ```

5. **Dev**
   ```bash
   npm run dev
   ```

## Pages (all gated behind `/login`)
- `/` — executive summary + portfolio grouped by Supabase project in collapsible cards. Each row is **drag-to-reorder** (persists per-group via the `display_order` column).
- `/apps/[slug]` — per-app detail with AI recommendation (keep/improve/merge/archive)
- `/weekly` — live + last-saved weekly view
- `/integrate` — copy-paste tracking snippet + PostHog webhook URL
- `/login` — Supabase email/password sign-in

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

## PostHog integration

Two ways to feed events into this dashboard:

1. **Direct fetch** to `/api/track` — best for server-side events and apps that don't need PostHog's product surface.
2. **PostHog → webhook → `/api/posthog/webhook`** — best when you already use PostHog for autocapture, session replay, funnels. PostHog stays the source of truth for raw events; this dashboard is the cross-app rollup.

### PostHog setup (per app)

1. In the app, install and init `posthog-js` with your project key.
2. After init, always call `posthog.register({ app_slug: "<this-app-slug>" })` so every captured event carries the slug.
3. In PostHog → Data pipeline → Destinations → New destination → **Webhook**:
   - URL: `https://app-analytics-mxf.vercel.app/api/posthog/webhook?token=$POSTHOG_WEBHOOK_SECRET`
   - Method: POST
   - Format: PostHog JSON (default)
4. Optional: instead of relying on `properties.app_slug`, pin one app per webhook by appending `&app_slug=<slug>` to the URL, or set the app's `posthog_project_id` in the `apps` table and the endpoint will look up by project id.

The webhook dedupes on PostHog's event `uuid`, so retries are safe.

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
