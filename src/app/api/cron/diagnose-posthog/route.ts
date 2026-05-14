import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendWeeklyEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BURST_START = "2026-05-14T21:50:00Z";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerAuth = req.headers.get("authorization");
  if (headerAuth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

interface PerAppRow {
  app_slug: string;
  n: number;
  last: string;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Totals
  const { data: burst, error: e1 } = await admin
    .from("app_usage_events")
    .select("id", { count: "exact", head: false })
    .eq("source_app", "posthog")
    .gt("occurred_at", BURST_START);
  if (e1) {
    return NextResponse.json({ error: "query_failed", detail: e1.message }, { status: 500 });
  }
  const burstCount = burst?.length ?? 0;

  // Per-app from burst
  const { data: rows } = await admin
    .from("app_usage_events")
    .select("app_slug, occurred_at")
    .eq("source_app", "posthog")
    .gt("occurred_at", BURST_START)
    .order("occurred_at", { ascending: false });

  const byApp = new Map<string, { n: number; last: string }>();
  for (const r of rows ?? []) {
    const slug = (r as { app_slug: string }).app_slug;
    const ts = (r as { occurred_at: string }).occurred_at;
    const cur = byApp.get(slug);
    if (cur) {
      cur.n += 1;
    } else {
      byApp.set(slug, { n: 1, last: ts });
    }
  }
  const perApp: PerAppRow[] = [...byApp.entries()]
    .map(([app_slug, v]) => ({ app_slug, n: v.n, last: v.last }))
    .sort((a, b) => b.last.localeCompare(a.last));

  // Latest posthog event regardless of burst
  const { data: latest } = await admin
    .from("app_usage_events")
    .select("occurred_at")
    .eq("source_app", "posthog")
    .order("occurred_at", { ascending: false })
    .limit(1);
  const latestTs = latest && latest.length > 0 ? (latest[0] as { occurred_at: string }).occurred_at : null;

  let verdict: "ok" | "partial" | "fail" = "fail";
  if (perApp.length >= 25 && burstCount >= 30) verdict = "ok";
  else if (perApp.length > 0) verdict = "partial";

  const html = renderHtml({ burstCount, perApp, verdict, latestTs });

  let emailId: string | null = null;
  const to = process.env.WEEKLY_SUMMARY_EMAIL;
  if (to) {
    try {
      const r = await sendWeeklyEmail({
        to,
        subject: `App Analytics — PostHog check (${verdict.toUpperCase()})`,
        html,
      });
      emailId = r.id;
    } catch (err) {
      return NextResponse.json(
        { error: "email_failed", detail: (err as Error).message, burstCount, perApp, verdict },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    verdict,
    burst_event_count: burstCount,
    distinct_apps_in_burst: perApp.length,
    per_app: perApp,
    latest_posthog_event: latestTs,
    email_id: emailId,
  });
}

function renderHtml(d: {
  burstCount: number;
  perApp: PerAppRow[];
  verdict: "ok" | "partial" | "fail";
  latestTs: string | null;
}): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const verdictColor = { ok: "#3a5a3a", partial: "#6b5a2a", fail: "#8b3a3a" }[d.verdict];
  const verdictLine = {
    ok: `Pipeline working end-to-end. ${d.burstCount} events from ${d.perApp.length} apps in the burst window.`,
    partial: `Partial delivery. ${d.burstCount} events from ${d.perApp.length} of 35 apps in the burst window. The other ${35 - d.perApp.length} apps' events likely didn't flush before navigation, or PostHog's filter excluded them.`,
    fail: `Zero events delivered from the burst. PostHog isn't forwarding to the webhook. Latest PostHog event in DB: ${d.latestTs ?? "never"}. Check the HTTP Webhook destination's Activity/Logs tab in PostHog to see delivery errors.`,
  }[d.verdict];

  const tableRows = d.perApp
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0">${esc(r.app_slug)}</td><td style="padding:6px 12px 6px 0;color:#6b6560">${r.n}</td><td style="padding:6px 0;color:#6b6560;font-size:12px">${esc(r.last.replace("T", " ").slice(0, 19))}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f5f0;color:#1f1d18;margin:0;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e1d6;border-radius:8px;padding:32px">
    <div style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.02em">App Analytics — PostHog check</div>
    <div style="color:#6b6560;font-size:13px;margin-top:4px">Burst window: ${esc(BURST_START)} → now</div>
    <hr style="border:none;border-top:1px solid #f0ebe0;margin:24px 0" />

    <div style="background:${verdictColor}1a;border-left:3px solid ${verdictColor};padding:12px 16px;border-radius:4px;margin-bottom:24px">
      <div style="text-transform:uppercase;letter-spacing:0.1em;font-size:11px;color:${verdictColor};font-weight:600">Verdict: ${d.verdict}</div>
      <div style="margin-top:6px;font-size:14px;line-height:1.5">${esc(verdictLine)}</div>
    </div>

    <div style="display:flex;gap:24px;margin-bottom:24px">
      <div><div style="font-size:11px;color:#a39c8d;text-transform:uppercase;letter-spacing:0.08em">Events in burst</div><div style="font-size:24px;margin-top:4px">${d.burstCount}</div></div>
      <div><div style="font-size:11px;color:#a39c8d;text-transform:uppercase;letter-spacing:0.08em">Distinct apps</div><div style="font-size:24px;margin-top:4px">${d.perApp.length}</div></div>
    </div>

    <div style="font-family:Georgia,serif;font-size:14px;margin-bottom:8px">Per-app breakdown</div>
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      ${tableRows || '<tr><td style="color:#a39c8d">No events from the burst yet.</td></tr>'}
    </table>

    <hr style="border:none;border-top:1px solid #f0ebe0;margin:24px 0" />
    <div style="color:#6b6560;font-size:13px;line-height:1.6">
      Dashboard: <a href="https://app-analytics-mxf.vercel.app" style="color:#1f1d18">app-analytics-mxf.vercel.app</a>
    </div>
  </div>
</body></html>`;
}
