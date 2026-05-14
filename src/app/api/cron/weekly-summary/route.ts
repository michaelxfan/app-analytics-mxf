import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { computeRollups } from "@/lib/analytics";
import { generateText } from "@/lib/anthropic";
import { sendWeeklyEmail } from "@/lib/email";
import { isSaturday9amToronto, lastSevenDaysRange, torontoNowParts } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerAuth = req.headers.get("authorization");
  if (headerAuth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  // Vercel Cron sets x-vercel-cron
  const vercelCron = req.headers.get("x-vercel-cron");
  if (vercelCron && headerAuth === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  const torontoPartsNow = torontoNowParts(now);

  if (!force && !isSaturday9amToronto(now)) {
    return NextResponse.json({
      skipped: true,
      reason: "not_saturday_9am_toronto",
      toronto: torontoPartsNow,
    });
  }

  const admin = supabaseAdmin();
  const { weekStart, weekEnd, startUtc, endUtc } = lastSevenDaysRange(now);

  // Prevent duplicate sends
  const { data: existing } = await admin
    .from("weekly_app_summaries")
    .select("id, sent_email")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!force && existing?.sent_email) {
    return NextResponse.json({ skipped: true, reason: "already_sent", week_start: weekStart });
  }

  const { rollups, totalEventsWeek, totalEventsThirty } = await computeRollups(now);

  const sorted = [...rollups].sort((a, b) => b.eventsThisWeek - a.eventsThisWeek);
  const topApps = sorted
    .filter((r) => r.eventsThisWeek > 0)
    .slice(0, 5)
    .map((r) => ({
      app_slug: r.app.app_slug,
      app_name: r.app.app_name,
      events: r.eventsThisWeek,
      pct: Number(r.usagePct.toFixed(2)),
    }));
  const deadApps = rollups
    .filter((r) => r.isDormant)
    .map((r) => ({
      app_slug: r.app.app_slug,
      app_name: r.app.app_name,
      last_used: r.lastUsed,
    }));
  const totalActiveApps = rollups.filter((r) => r.eventsThisWeek > 0).length;

  // AI summary
  let aiSummary = "";
  try {
    const bullets = rollups
      .map(
        (r) =>
          `- ${r.app.app_name} (${r.app.app_slug}) [${r.app.status}/${r.app.priority}] — week:${r.eventsThisWeek} 30d:${r.eventsLast30Days} pct:${r.usagePct.toFixed(1)}% lastUsed:${r.lastUsed ?? "never"}`
      )
      .join("\n");
    aiSummary = await generateText(
      "You are a concise executive analyst writing a weekly app portfolio digest for one person (the owner of all these apps). Be direct, tasteful, no fluff.",
      `Week ${weekStart} to ${weekEnd}. Total events: ${totalEventsWeek}. 30-day events: ${totalEventsThirty}.\n\nPer-app stats:\n${bullets}\n\nWrite a 5-7 sentence executive summary covering: where attention concentrated, momentum shifts, dormant apps that should likely be archived, and one or two specific recommended next moves.`,
      700
    );
  } catch (err) {
    aiSummary = `AI summary unavailable: ${(err as Error).message}`;
  }

  // Upsert weekly summary
  const { data: upserted, error: upsertErr } = await admin
    .from("weekly_app_summaries")
    .upsert(
      {
        week_start: weekStart,
        week_end: weekEnd,
        total_events: totalEventsWeek,
        total_active_apps: totalActiveApps,
        top_apps: topApps,
        dead_apps: deadApps,
        ai_summary: aiSummary,
        sent_email: false,
      },
      { onConflict: "week_start" }
    )
    .select()
    .single();
  if (upsertErr) {
    return NextResponse.json({ error: "save_failed", detail: upsertErr.message }, { status: 500 });
  }

  // Send email
  const toEmail = process.env.WEEKLY_SUMMARY_EMAIL;
  let emailId: string | null = null;
  if (toEmail) {
    const html = renderEmailHtml({
      weekStart,
      weekEnd,
      totalEvents: totalEventsWeek,
      totalActiveApps,
      topApps,
      deadApps,
      aiSummary,
    });
    try {
      const r = await sendWeeklyEmail({
        to: toEmail,
        subject: "Weekly App Analytics Summary",
        html,
      });
      emailId = r.id;
      await admin
        .from("weekly_app_summaries")
        .update({ sent_email: true })
        .eq("id", upserted.id);
    } catch (err) {
      return NextResponse.json(
        { error: "email_failed", detail: (err as Error).message, summary_id: upserted.id },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    week_start: weekStart,
    week_end: weekEnd,
    total_events: totalEventsWeek,
    total_active_apps: totalActiveApps,
    email_id: emailId,
    range_utc: { start: startUtc.toISOString(), end: endUtc.toISOString() },
  });
}

function renderEmailHtml(d: {
  weekStart: string;
  weekEnd: string;
  totalEvents: number;
  totalActiveApps: number;
  topApps: Array<{ app_slug: string; app_name: string; events: number; pct: number }>;
  deadApps: Array<{ app_slug: string; app_name: string; last_used: string | null }>;
  aiSummary: string;
}): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const top = d.topApps
    .map(
      (t) =>
        `<tr><td style="padding:6px 12px 6px 0">${escape(t.app_name)}</td><td style="padding:6px 12px 6px 0;color:#6b6560">${t.events}</td><td style="padding:6px 0;color:#6b6560">${t.pct.toFixed(1)}%</td></tr>`
    )
    .join("");
  const dead = d.deadApps
    .map(
      (a) =>
        `<li style="padding:2px 0">${escape(a.app_name)} <span style="color:#9e9890">— last used ${a.last_used ? escape(a.last_used.slice(0, 10)) : "never"}</span></li>`
    )
    .join("");
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf9f7;color:#1a1a1a;margin:0;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e5e0;border-radius:8px;padding:32px">
    <div style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.02em">App Analytics</div>
    <div style="color:#6b6560;font-size:13px;margin-top:4px">${escape(d.weekStart)} → ${escape(d.weekEnd)}</div>
    <hr style="border:none;border-top:1px solid #f0ede8;margin:24px 0" />
    <div style="display:flex;gap:24px;margin-bottom:24px">
      <div><div style="font-size:11px;color:#9e9890;text-transform:uppercase;letter-spacing:0.08em">Events</div><div style="font-size:24px;margin-top:4px">${d.totalEvents}</div></div>
      <div><div style="font-size:11px;color:#9e9890;text-transform:uppercase;letter-spacing:0.08em">Active apps</div><div style="font-size:24px;margin-top:4px">${d.totalActiveApps}</div></div>
      <div><div style="font-size:11px;color:#9e9890;text-transform:uppercase;letter-spacing:0.08em">Dormant</div><div style="font-size:24px;margin-top:4px">${d.deadApps.length}</div></div>
    </div>
    <div style="font-family:Georgia,serif;font-size:14px;margin-bottom:8px">Top apps this week</div>
    <table style="width:100%;font-size:14px;border-collapse:collapse">${top || '<tr><td style="color:#9e9890">No usage this week.</td></tr>'}</table>
    <div style="font-family:Georgia,serif;font-size:14px;margin:24px 0 8px">Dormant (30+ days)</div>
    <ul style="font-size:14px;padding-left:18px;margin:0">${dead || '<li style="color:#9e9890">None.</li>'}</ul>
    <div style="font-family:Georgia,serif;font-size:14px;margin:24px 0 8px">Summary</div>
    <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escape(d.aiSummary)}</div>
  </div>
</body></html>`;
}
