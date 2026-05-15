import { computeRollups, type AppUsageRollup } from "@/lib/analytics";
import SortableAppTable, { type SortableRow } from "@/components/SortableAppRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Group {
  key: string;
  label: string;
  rollups: AppUsageRollup[];
  weekTotal: number;
  thirtyTotal: number;
  activeCount: number;
  dormantCount: number;
}

function rollupToSortableRow(r: AppUsageRollup): SortableRow {
  const a = r.app;
  return {
    id: a.id,
    app_slug: a.app_slug,
    app_name: a.app_name,
    app_url: a.app_url,
    github_repo_url: a.github_repo_url,
    category: a.category,
    status: a.status,
    priority: a.priority,
    events_week: r.eventsThisWeek,
    events_thirty: r.eventsLast30Days,
    usage_pct: r.usagePct,
    weekly_change: r.weeklyChange,
    thirty_change: r.thirtyDayChange,
    last_used: r.lastUsed,
    is_dormant: r.isDormant,
  };
}

function groupBySupabase(rollups: AppUsageRollup[]): Group[] {
  const byKey = new Map<string, AppUsageRollup[]>();
  for (const r of rollups) {
    const key = r.app.supabase_project_name ?? "unassigned";
    const list = byKey.get(key) ?? [];
    list.push(r);
    byKey.set(key, list);
  }
  const groups: Group[] = [];
  for (const [key, list] of byKey) {
    // Preserve display_order set by drag-to-reorder; fall back to weekly events, then name
    list.sort((a, b) => {
      const ao = a.app.display_order ?? Number.POSITIVE_INFINITY;
      const bo = b.app.display_order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (a.eventsThisWeek !== b.eventsThisWeek) return b.eventsThisWeek - a.eventsThisWeek;
      return a.app.app_name.localeCompare(b.app.app_name);
    });
    const weekTotal = list.reduce((s, r) => s + r.eventsThisWeek, 0);
    const thirtyTotal = list.reduce((s, r) => s + r.eventsLast30Days, 0);
    const activeCount = list.filter((r) => r.eventsThisWeek > 0).length;
    const dormantCount = list.filter((r) => r.isDormant).length;
    groups.push({
      key,
      label: key === "unassigned" ? "Unassigned" : key,
      rollups: list,
      weekTotal,
      thirtyTotal,
      activeCount,
      dormantCount,
    });
  }
  // Sort groups: most weekly activity first, then most apps, then alpha
  groups.sort((a, b) => b.weekTotal - a.weekTotal || b.rollups.length - a.rollups.length || a.label.localeCompare(b.label));
  return groups;
}

function GroupTable({ rows }: { rows: AppUsageRollup[] }) {
  return <SortableAppTable rows={rows.map(rollupToSortableRow)} />;
}

export default async function Page() {
  let rollups: AppUsageRollup[] = [];
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
  const mostUsed = [...rollups].sort((a, b) => b.eventsThisWeek - a.eventsThisWeek)[0]?.eventsThisWeek
    ? [...rollups].sort((a, b) => b.eventsThisWeek - a.eventsThisWeek)[0].app
    : null;
  const highLeverage = rollups.find((r) => r.app.high_leverage)?.app ?? null;

  const groups = groupBySupabase(rollups);

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

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((g, i) => {
          const pct = totalEventsWeek > 0 ? (g.weekTotal / totalEventsWeek) * 100 : 0;
          return (
            <details key={g.key} open={i < 2} className="card" style={{ padding: 0 }}>
              <summary
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 16,
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  borderBottom: "1px solid var(--border-light)",
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span>{g.label}</span>
                  <span className="tiny" style={{ opacity: 0.8 }}>
                    {g.rollups.length} {g.rollups.length === 1 ? "app" : "apps"}
                  </span>
                </span>
                <span className="tiny tabular" style={{ display: "flex", gap: 14, opacity: 0.85 }}>
                  <span>7d: <strong>{g.weekTotal}</strong></span>
                  <span>30d: <strong>{g.thirtyTotal}</strong></span>
                  <span>active: <strong>{g.activeCount}</strong></span>
                  <span>dormant: <strong>{g.dormantCount}</strong></span>
                  <span>share: <strong>{Math.round(pct)}%</strong></span>
                </span>
              </summary>
              <div style={{ overflow: "hidden" }}>
                <GroupTable rows={g.rollups} />
              </div>
            </details>
          );
        })}
        {groups.length === 0 && !loadError && (
          <div className="card muted" style={{ textAlign: "center", padding: 24 }}>No apps yet. Run the seed script.</div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <details>
          <summary>How usage % is calculated</summary>
          <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, paddingTop: 8 }}>
            Usage % is each app&apos;s share of total tracked events across all apps in the last 7 days.
            Dormant means no events in the last 30 days. Weekly and 30-day deltas compare against the prior equivalent window.
            Groups are ordered by total weekly events, then by app count.
          </div>
        </details>
      </section>
    </div>
  );
}
