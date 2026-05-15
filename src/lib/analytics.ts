import { supabaseAdmin } from "./supabase";
import { AppRow, UsageEventRow } from "./types";
import { thirtyDayWindow } from "./time";

export async function fetchAllApps(): Promise<AppRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("apps")
    .select("*")
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("app_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppRow[];
}

export async function fetchAppBySlug(slug: string): Promise<AppRow | null> {
  const { data, error } = await supabaseAdmin()
    .from("apps")
    .select("*")
    .eq("app_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as AppRow) ?? null;
}

export async function fetchEventsBetween(start: Date, end: Date): Promise<UsageEventRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("app_usage_events")
    .select("*")
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as UsageEventRow[];
}

export async function fetchEventsForApp(appId: string, limit = 200): Promise<UsageEventRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("app_usage_events")
    .select("*")
    .eq("app_id", appId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UsageEventRow[];
}

export interface AppUsageRollup {
  app: AppRow;
  eventsThisWeek: number;
  eventsLast30Days: number;
  usagePct: number; // share of last-7-day events
  lastUsed: string | null;
  isDormant: boolean;
  weeklyChange: number; // events this week vs prior 7
  thirtyDayChange: number; // events last 30 vs prior 30
}

export async function computeRollups(now: Date = new Date()): Promise<{
  rollups: AppUsageRollup[];
  totalEventsWeek: number;
  totalEventsThirty: number;
}> {
  const apps = await fetchAllApps();
  const { startUtc: thirtyStart, endUtc } = thirtyDayWindow(now);
  const sixtyStart = new Date(endUtc.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sevenStart = new Date(endUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenStart = new Date(endUtc.getTime() - 14 * 24 * 60 * 60 * 1000);

  const allEvents = await fetchEventsBetween(sixtyStart, endUtc);

  const byApp = new Map<string, UsageEventRow[]>();
  for (const e of allEvents) {
    if (!e.app_id) continue;
    const arr = byApp.get(e.app_id) ?? [];
    arr.push(e);
    byApp.set(e.app_id, arr);
  }

  const isWithin = (e: UsageEventRow, s: Date, end: Date) => {
    const t = new Date(e.occurred_at).getTime();
    return t >= s.getTime() && t < end.getTime();
  };

  const totalEventsWeek = allEvents.filter((e) => isWithin(e, sevenStart, endUtc)).length;
  const totalEventsThirty = allEvents.filter((e) => isWithin(e, thirtyStart, endUtc)).length;

  const rollups: AppUsageRollup[] = apps.map((app) => {
    const events = byApp.get(app.id) ?? [];
    const week = events.filter((e) => isWithin(e, sevenStart, endUtc)).length;
    const priorWeek = events.filter((e) => isWithin(e, fourteenStart, sevenStart)).length;
    const thirty = events.filter((e) => isWithin(e, thirtyStart, endUtc)).length;
    const priorThirty = events.filter((e) => isWithin(e, sixtyStart, thirtyStart)).length;
    const lastUsed = events.length > 0 ? events[0].occurred_at : null;
    const usagePct = totalEventsWeek > 0 ? (week / totalEventsWeek) * 100 : 0;
    return {
      app,
      eventsThisWeek: week,
      eventsLast30Days: thirty,
      usagePct,
      lastUsed,
      isDormant: thirty === 0,
      weeklyChange: week - priorWeek,
      thirtyDayChange: thirty - priorThirty,
    };
  });

  return { rollups, totalEventsWeek, totalEventsThirty };
}
