import { NextRequest, NextResponse } from "next/server";
import { supabaseMiddlewareClient } from "@/lib/supabaseServer";

const PUBLIC_PATHS = ["/login", "/api/track", "/api/cron", "/api/posthog", "/api/auth"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip Next internals + assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // skip assets
  ) {
    return NextResponse.next();
  }

  // Skip public paths
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      return NextResponse.next();
    }
  }

  const res = NextResponse.next();
  const supabase = supabaseMiddlewareClient(req, res);
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
