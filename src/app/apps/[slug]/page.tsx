import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAppBySlug, fetchEventsForApp, computeRollups } from "@/lib/analytics";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { generateText } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

async function getRecommendation(appName: string, ctx: string): Promise<string> {
  try {
    return await generateText(
      "You evaluate personal app portfolios. Output ONE of: KEEP / IMPROVE / MERGE / ARCHIVE, then a colon, then one tight sentence of reasoning (max 25 words). No preamble.",
      `App: ${appName}\n${ctx}`,
      120
    );
  } catch {
    return "KEEP: AI unavailable.";
  }
}

export default async function AppDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await fetchAppBySlug(slug);
  if (!app) notFound();

  const events = await fetchEventsForApp(app.id, 200);
  const { rollups, totalEventsWeek } = await computeRollups();
  const mine = rollups.find((r) => r.app.id === app.id);

  const eventCounts = new Map<string, number>();
  for (const e of events) {
    eventCounts.set(e.event_name, (eventCounts.get(e.event_name) ?? 0) + 1);
  }
  const topEvents = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const ctx = `Status: ${app.status}. Priority: ${app.priority}. 7-day events: ${mine?.eventsThisWeek ?? 0}. 30-day events: ${mine?.eventsLast30Days ?? 0}. Total portfolio events this week: ${totalEventsWeek}. Last used: ${mine?.lastUsed ?? "never"}. Description: ${app.description ?? "n/a"}.`;
  const recommendation = await getRecommendation(app.app_name, ctx);

  return (
    <div className="container-narrow">
      <div style={{ marginBottom: 8 }}>
        <Link href="/" className="link tiny">← Portfolio</Link>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>{app.app_name}</h1>
        <StatusBadge status={app.status} />
        <PriorityBadge priority={app.priority} />
      </div>
      <div className="muted tiny" style={{ marginBottom: 24 }}>
        {app.app_slug} · {app.supabase_project_name ?? "no project"} {app.category ? `· ${app.category}` : ""}
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div className="card-muted"><div className="stat-label">7-day</div><div className="stat-value tabular">{mine?.eventsThisWeek ?? 0}</div></div>
        <div className="card-muted"><div className="stat-label">30-day</div><div className="stat-value tabular">{mine?.eventsLast30Days ?? 0}</div></div>
        <div className="card-muted"><div className="stat-label">Usage %</div><div className="stat-value tabular">{mine ? Math.round(mine.usagePct) : 0}%</div></div>
        <div className="card-muted"><div className="stat-label">Last active</div><div className="stat-value" style={{ fontSize: 16 }}>{mine?.lastUsed ? fmtDate(mine.lastUsed) : "—"}</div></div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>Overview</div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
          {app.description || "No description yet."}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
          {app.app_url && <a href={app.app_url} target="_blank" rel="noreferrer" className="link tiny">↗ {app.app_url}</a>}
          {app.github_repo_url && <a href={app.github_repo_url} target="_blank" rel="noreferrer" className="link tiny">↗ {app.github_repo_url}</a>}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>AI recommendation</div>
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>{recommendation}</div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 12 }}>Main events</div>
        {topEvents.length === 0 ? (
          <div className="muted tiny">No events recorded.</div>
        ) : (
          <table className="portfolio">
            <thead><tr><th>Event</th><th className="tabular" style={{ textAlign: "right" }}>Count</th></tr></thead>
            <tbody>
              {topEvents.map(([name, count]) => (
                <tr key={name}><td>{name}</td><td className="tabular" style={{ textAlign: "right" }}>{count}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <details open>
          <summary>Recent activity ({events.length})</summary>
          <div style={{ marginTop: 8, maxHeight: 360, overflow: "auto" }}>
            {events.length === 0 ? (
              <div className="muted tiny">No events yet.</div>
            ) : (
              <table className="portfolio">
                <thead><tr><th>When</th><th>Event</th><th>Type</th></tr></thead>
                <tbody>
                  {events.slice(0, 50).map((e) => (
                    <tr key={e.id}>
                      <td className="tiny">{fmtDate(e.occurred_at)}</td>
                      <td>{e.event_name}</td>
                      <td className="tiny">{e.event_type ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </details>
        {app.notes && (
          <details style={{ marginTop: 8 }}>
            <summary>Notes</summary>
            <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap" }}>{app.notes}</div>
          </details>
        )}
      </section>
    </div>
  );
}
