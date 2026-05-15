import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { computeRollups } from "@/lib/analytics";
import { generateText } from "@/lib/anthropic";
import { WeeklySummaryRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getLatestStored(): Promise<WeeklySummaryRow | null> {
  const { data } = await supabaseAdmin()
    .from("weekly_app_summaries")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as WeeklySummaryRow) ?? null;
}

async function getLiveSummary(): Promise<string> {
  try {
    const { rollups, totalEventsWeek } = await computeRollups();
    const bullets = rollups
      .map((r) => `- ${r.app.app_name} week:${r.eventsThisWeek} 30d:${r.eventsLast30Days} pct:${r.usagePct.toFixed(1)}%`)
      .join("\n");
    return await generateText(
      "You are a concise executive analyst for a personal app portfolio. Be direct.",
      `Total 7-day events: ${totalEventsWeek}.\n${bullets}\n\nWrite a 4-sentence summary: where attention is, what's declining, what should be archived, one move to make.`,
      400
    );
  } catch (err) {
    return `Live summary unavailable: ${(err as Error).message}`;
  }
}

export default async function WeeklyPage() {
  const stored = await getLatestStored();
  const { rollups, totalEventsWeek } = await computeRollups();

  const top = [...rollups].sort((a, b) => b.eventsThisWeek - a.eventsThisWeek).filter((r) => r.eventsThisWeek > 0).slice(0, 5);
  const declining = rollups.filter((r) => r.weeklyChange < 0).sort((a, b) => a.weeklyChange - b.weeklyChange).slice(0, 5);
  const dormant = rollups.filter((r) => r.isDormant);
  const liveSummary = await getLiveSummary();

  return (
    <div className="container-narrow">
      <div style={{ marginBottom: 24 }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>Weekly summary</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          Live view. The Saturday 9am email digests this, generated via cron.
        </p>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>This week (live)</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{liveSummary}</div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>Top 5 by usage</div>
          {top.length === 0 ? (
            <div className="muted tiny">No usage yet this week.</div>
          ) : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {top.map((r) => (
                <li key={r.app.id} style={{ padding: "4px 0" }}>
                  <Link href={`/apps/${r.app.app_slug}`} className="link">{r.app.app_name}</Link>{" "}
                  <span className="tiny">{r.eventsThisWeek} events · {Math.round(r.usagePct)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>Declining</div>
          {declining.length === 0 ? (
            <div className="muted tiny">Nothing declining.</div>
          ) : (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {declining.map((r) => (
                <li key={r.app.id} style={{ padding: "4px 0" }}>
                  <Link href={`/apps/${r.app.app_slug}`} className="link">{r.app.app_name}</Link>{" "}
                  <span className="tiny">{r.weeklyChange} week-over-week</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>Not opened in 30 days</div>
        {dormant.length === 0 ? (
          <div className="muted tiny">Every app has activity in the last 30 days.</div>
        ) : (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {dormant.map((r) => (
              <li key={r.app.id} style={{ padding: "4px 0" }}>
                <Link href={`/apps/${r.app.app_slug}`} className="link">{r.app.app_name}</Link>{" "}
                <span className="tiny">last used {r.lastUsed ? new Date(r.lastUsed).toLocaleDateString("en-CA") : "never"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <details>
          <summary>Last saved weekly snapshot</summary>
          <div style={{ paddingTop: 8 }}>
            {!stored ? (
              <div className="muted tiny">No saved weekly snapshot yet. The cron writes one each Saturday.</div>
            ) : (
              <div>
                <div className="tiny" style={{ marginBottom: 6 }}>
                  {stored.week_start} → {stored.week_end} · events {stored.total_events} · active {stored.total_active_apps} · {stored.sent_email ? "emailed" : "not emailed"}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{stored.ai_summary ?? ""}</div>
              </div>
            )}
          </div>
        </details>
      </section>

      <div className="tiny muted">Total 7-day events: {totalEventsWeek}.</div>
    </div>
  );
}
