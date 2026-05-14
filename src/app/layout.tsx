import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import PostHogProvider from "@/components/PostHogProvider";

export const metadata: Metadata = {
  title: "App Analytics",
  description: "Personal meta-dashboard for tracking app usage across projects.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
                <nav style={{ display: "flex", gap: 20, fontSize: 13 }}>
                  <Link href="/" className="link">Portfolio</Link>
                  <Link href="/weekly" className="link">Weekly</Link>
                  <Link href="/integrate" className="link">Integrate</Link>
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
