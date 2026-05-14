import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PosthogEvent {
  event?: string;
  uuid?: string;
  distinct_id?: string;
  timestamp?: string;
  properties?: Record<string, unknown> & { app_slug?: string; posthog_project_id?: string };
  team_id?: number | string;
  project_id?: number | string;
  app_slug?: string;
  current_url?: string;
}

function getEventArray(body: unknown): PosthogEvent[] {
  if (Array.isArray(body)) return body as PosthogEvent[];
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as PosthogEvent[];
    if (Array.isArray(obj.batch)) return obj.batch as PosthogEvent[];
    return [obj as PosthogEvent];
  }
  return [];
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.POSTHOG_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const url = new URL(req.url);
  const providedToken =
    url.searchParams.get("token") ||
    req.headers.get("x-posthog-secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (providedToken !== secret) return unauthorized();

  const urlSlug = url.searchParams.get("app_slug");
  const urlProjectId = url.searchParams.get("posthog_project_id");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const events = getEventArray(body);
  if (events.length === 0) return NextResponse.json({ error: "no_events" }, { status: 400 });

  const admin = supabaseAdmin();
  const slugCache = new Map<string, string | null>();
  async function findAppId(slug: string | null, projectId: string | null): Promise<string | null> {
    if (slug) {
      if (slugCache.has(slug)) return slugCache.get(slug) ?? null;
      const { data } = await admin.from("apps").select("id").eq("app_slug", slug).maybeSingle();
      const id = (data?.id as string) ?? null;
      slugCache.set(slug, id);
      if (id) return id;
    }
    if (projectId) {
      const cacheKey = `pid:${projectId}`;
      if (slugCache.has(cacheKey)) return slugCache.get(cacheKey) ?? null;
      const { data } = await admin
        .from("apps")
        .select("id")
        .eq("posthog_project_id", projectId)
        .maybeSingle();
      const id = (data?.id as string) ?? null;
      slugCache.set(cacheKey, id);
      return id;
    }
    return null;
  }

  const rows: Array<Record<string, unknown>> = [];
  const skipped: Array<{ reason: string; event?: string; slug?: string | null }> = [];

  for (const e of events) {
    const props = e.properties ?? {};
    const slug = urlSlug || e.app_slug || props.app_slug || null;
    const projectId =
      urlProjectId ||
      props.posthog_project_id ||
      (e.project_id != null ? String(e.project_id) : null);
    const appId = await findAppId(slug, projectId);
    if (!appId) {
      skipped.push({ reason: "unknown_app", event: e.event, slug });
      continue;
    }
    const eventName = e.event ?? "unknown";
    const occurredAt = e.timestamp ? new Date(e.timestamp) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      skipped.push({ reason: "invalid_timestamp", event: eventName });
      continue;
    }
    rows.push({
      app_id: appId,
      app_slug: slug ?? "",
      event_name: eventName,
      event_type: "posthog",
      source_app: "posthog",
      user_id: e.distinct_id ?? null,
      posthog_distinct_id: e.distinct_id ?? null,
      posthog_event_id: e.uuid ?? null,
      metadata: props,
      occurred_at: occurredAt.toISOString(),
    });
  }

  // Refresh app_slug for rows that came in without a slug but matched by project_id
  for (const row of rows) {
    if (!row.app_slug) {
      const { data } = await admin.from("apps").select("app_slug").eq("id", row.app_id).maybeSingle();
      row.app_slug = data?.app_slug ?? "";
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const eventIds = rows
      .map((r) => r.posthog_event_id)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    let existing = new Set<string>();
    if (eventIds.length > 0) {
      const { data: dups } = await admin
        .from("app_usage_events")
        .select("posthog_event_id")
        .in("posthog_event_id", eventIds);
      existing = new Set((dups ?? []).map((d) => d.posthog_event_id as string));
    }
    const toInsert = rows.filter((r) => {
      const id = r.posthog_event_id;
      if (typeof id === "string" && existing.has(id)) {
        skipped.push({ reason: "duplicate", event: String(r.event_name ?? ""), slug: String(r.app_slug ?? "") });
        return false;
      }
      return true;
    });
    if (toInsert.length > 0) {
      const { error } = await admin.from("app_usage_events").insert(toInsert);
      if (error) {
        return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
      }
      inserted = toInsert.length;
    }
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
