import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrackBody {
  app_slug?: string;
  event_name?: string;
  event_type?: string;
  source_app?: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: corsHeaders() });
  }

  const slug = (body.app_slug ?? "").trim();
  const eventName = (body.event_name ?? "").trim();
  if (!slug || !eventName) {
    return NextResponse.json(
      { error: "missing_required_fields", required: ["app_slug", "event_name"] },
      { status: 400, headers: corsHeaders() }
    );
  }
  if (slug.length > 100 || eventName.length > 100) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400, headers: corsHeaders() });
  }

  const admin = supabaseAdmin();
  const { data: app, error: appErr } = await admin
    .from("apps")
    .select("id, app_slug")
    .eq("app_slug", slug)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500, headers: corsHeaders() });
  }
  if (!app) {
    return NextResponse.json(
      { error: "unknown_app_slug", app_slug: slug },
      { status: 404, headers: corsHeaders() }
    );
  }

  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "invalid_occurred_at" }, { status: 400, headers: corsHeaders() });
  }

  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  const { error: insErr } = await admin.from("app_usage_events").insert({
    app_id: app.id,
    app_slug: app.app_slug,
    event_name: eventName,
    event_type: body.event_type ?? null,
    source_app: body.source_app ?? null,
    user_id: body.user_id ?? null,
    metadata,
    occurred_at: occurredAt.toISOString(),
  });

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500, headers: corsHeaders() });
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders() });
}
