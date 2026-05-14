import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import PostHogProvider from "@/components/PostHogProvider";
import { getCurrentUser } from "@/lib/supabaseServer";

export const metadata: Metadata = {
  title: "App Analytics",
  description: "Personal meta-dashboard for tracking app usage across projects.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | null = null;
  try {
    const user = await getCurrentUser();
    userEmail = user?.email ?? null;
  } catch {
    // ignore on /login or when cookies aren't ready
  }
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <PostHogProvider>
            <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="container-narrow" style={{ paddingTop: 18, paddingBottom: 18, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <Link href="/" className="serif" style={{ fontSize: 18 }}>
                  App Analytics
                </Link>
                <nav style={{ display: "flex", gap: 20, fontSize: 13, alignItems: "center" }}>
                  <Link href="/" className="link">Portfolio</Link>
                  <Link href="/weekly" className="link">Weekly</Link>
                  <Link href="/integrate" className="link">Integrate</Link>
                  {userEmail && (
                    <form action="/api/auth/signout" method="post" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span className="tiny" style={{ opacity: 0.7 }}>{userEmail}</span>
                      <button
                        type="submit"
                        className="link"
                        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", fontSize: 13 }}
                      >
                        Sign out
                      </button>
                    </form>
                  )}
                </nav>
              </div>
            </header>
            <main>{children}</main>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
