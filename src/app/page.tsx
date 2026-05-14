import Link from "next/link";
import { computeRollups } from "@/lib/analytics";
import { StatusBadge, PriorityBadge, DormantBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function delta(n: number): string {
  if (n === 0) return "±0";
  return n > 0 ? `+${n}` : `${n}`;
}

export default async function Page() {
  let rollups: Awaited<ReturnType<typeof computeRollups>>["rollups"] = [];
  let totalEventsWeek = 0;
  let totalEventsThirty = 0;
  let loadError: string | null = null;

  try {
    const r = await computeRollups();
    rollups = r.rollups;
    totalEventsWeek = r.totalEventsWeek;
    totalEventsThirty = r.totalEventsThirty;
  } catch (err) {
    loadError = (err as Error).message;
  }

  const totalApps = rollups.length;
  const activeThisWeek = rollups.filter((r) => r.eventsThisWeek > 0).length;
  const dormant = rollups.filter((r) => r.isDormant).length;
  const sorted = [...rollups].sort((a, b) => b.eventsThisWeek - a.eventsThisWeek);
  const mostUsed = sorted[0]?.eventsThisWeek ? sorted[0].app : null;
  const highLeverage = rollups.find((r) => r.app.high_leverage)?.app ?? null;

  return (
    <div className="container-narrow">
      <div style={{ marginBottom: 28 }}>
        <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>Portfolio</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          A meta-dashboard for every personal app, scored by attention and outcomes.
        </p>
      </div>

      {loadError && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--bad-bg)" }}>
          <div className="serif" style={{ fontSize: 14 }}>Couldn&apos;t load data</div>
          <div className="tiny" style={{ marginTop: 4 }}>{loadError}</div>
          <div className="tiny" style={{ marginTop: 8 }}>Check that env vars are set in <code>.env.local</code>.</div>
        </div>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <div className="card-muted"><div className="stat-label">Total apps</div><div className="stat-value tabular">{totalApps}</div></div>
        <div className="card-muted"><div className="stat-label">Active this week</div><div className="stat-value tabular">{activeThisWeek}</div></div>
        <div className="card-muted"><div className="stat-label">Dormant</div><div className="stat-value tabular">{dormant}</div></div>
        <div className="card-muted"><div className="stat-label">Events (7d)</div><div className="stat-value tabular">{totalEventsWeek}</div></div>
        <div className="card-muted"><div className="stat-label">Events (30d)</div><div className="stat-value tabular">{totalEventsThirty}</div></div>
        <div className="card-muted">
          <div className="stat-label">Most used</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{mostUsed?.app_name ?? "—"}</div>
        </div>
        <div className="card-muted">
          <div className="stat-label">High leverage</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{highLeverage?.app_name ?? "—"}</div>
        </div>
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="portfolio">
          <thead>
            <tr>
              <th>App</th>
              <th>Project</th>
              <th>Category</th>
              <th>Status</th>
              <th>Pri</th>
              <th className="tabular" style={{ textAlign: "right" }}>7d</th>
              <th className="tabular" style={{ textAlign: "right" }}>30d</th>
              <th className="tabular" style={{ textAlign: "right" }}>Usage %</th>
              <th>Last used</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const a = r.app;
              return (
                <tr key={a.id}>
                  <td>
                    <Link href={`/apps/${a.app_slug}`} className="link" style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--text-primary)" }}>
                      {a.app_name}
                    </Link>
                    {r.isDormant && <span style={{ marginLeft: 8 }}><DormantBadge /></span>}
                    <div className="tiny" style={{ marginTop: 2 }}>
                      {a.app_url && <a href={a.app_url} target="_blank" rel="noreferrer" className="link">site</a>}
                      {a.app_url && a.github_repo_url && <span> · </span>}
                      {a.github_repo_url && <a href={a.github_repo_url} target="_blank" rel="noreferrer" className="link">repo</a>}
                    </div>
                  </td>
                  <td className="tiny">{a.supabase_project_name ?? "—"}</td>
                  <td className="tiny">{a.category ?? "—"}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td><PriorityBadge priority={a.priority} /></td>
                  <td className="tabular" style={{ textAlign: "right" }}>
                    {r.eventsThisWeek}
                    <div className="tiny">{delta(r.weeklyChange)}</div>
                  </td>
                  <td className="tabular" style={{ textAlign: "right" }}>
                    {r.eventsLast30Days}
                    <div className="tiny">{delta(r.thirtyDayChange)}</div>
                  </td>
                  <td className="tabular" style={{ textAlign: "right" }}>{r.usagePct.toFixed(1)}%</td>
                  <td className="tiny">{fmtDate(r.lastUsed)}</td>
                </tr>
              );
            })}
            {sorted.length === 0 && !loadError && (
              <tr><td colSpan={9} className="muted" style={{ padding: 24, textAlign: "center" }}>No apps yet. Run the seed script.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <details>
          <summary>How usage % is calculated</summary>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, paddingTop: 8 }}>
            Usage % is each app&apos;s share of total tracked events across all apps in the last 7 days.
            Dormant means no events in the last 30 days. Weekly and 30-day deltas compare against the prior equivalent window.
          </div>
        </details>
      </section>
    </div>
  );
}
