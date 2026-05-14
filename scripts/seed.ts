/* eslint-disable @typescript-eslint/no-require-imports */
// Seeds the apps table. Usage: npm run seed
import { createClient } from "@supabase/supabase-js";

type Status = "active" | "experimental" | "paused" | "deprecated";
type Priority = "P0" | "P1" | "P2" | "P3";

interface SeedApp {
  app_name: string;
  app_slug: string;
  supabase_project_name: string | null;
  supabase_project_group: string | null;
  category: string | null;
  status: Status;
  priority: Priority;
  description: string;
  high_leverage?: boolean;
}

const APPS: SeedApp[] = [
  { app_name: "Idea Capture v2", app_slug: "idea-capture-v2", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "capture", status: "active", priority: "P0", description: "Messy thoughts in, structured tasks out.", high_leverage: true },
  { app_name: "Vendor Credibility", app_slug: "vendor-credibility", supabase_project_name: "professional-mxf", supabase_project_group: "professional", category: "research", status: "active", priority: "P1", description: "Score vendors on credibility signals." },
  { app_name: "CPG Company Research", app_slug: "cpg-company-research-app", supabase_project_name: "professional-mxf", supabase_project_group: "professional", category: "research", status: "active", priority: "P1", description: "Deep CPG company research dossiers." },
  { app_name: "Job Search", app_slug: "job-search-app-michaelxfan", supabase_project_name: "professional-mxf", supabase_project_group: "professional", category: "career", status: "experimental", priority: "P2", description: "Personalized job search and tracking." },
  { app_name: "Dual Intent OS", app_slug: "dual-intent-os", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "framework", status: "active", priority: "P1", description: "Operates on dual-intent decisions." },
  { app_name: "Agency Coach", app_slug: "agency-coach", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "coaching", status: "active", priority: "P1", description: "Agency-of-self coaching." },
  { app_name: "Indeed Search", app_slug: "indeed-search-app", supabase_project_name: "professional-mxf", supabase_project_group: "professional", category: "career", status: "experimental", priority: "P3", description: "Indeed search wrapper." },
  { app_name: "Market Intel", app_slug: "market-intel-ashy-two", supabase_project_name: "professional-mxf", supabase_project_group: "professional", category: "research", status: "active", priority: "P1", description: "Market intelligence dashboard." },
  { app_name: "Finance MXF", app_slug: "finance-mxf", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "finance", status: "active", priority: "P0", description: "Personal finance dashboard.", high_leverage: true },
  { app_name: "Decision Rule", app_slug: "decision-rule", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "framework", status: "experimental", priority: "P2", description: "Codify and apply decision rules." },
  { app_name: "Opportunity Memory", app_slug: "opportunity-memory-mxf", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "memory", status: "active", priority: "P1", description: "Long-term opportunity memory store." },
  { app_name: "App Analytics", app_slug: "app-analytics-mxf", supabase_project_name: "personal-mxf", supabase_project_group: "personal", category: "meta", status: "active", priority: "P0", description: "This app. Meta-dashboard for the portfolio.", high_leverage: true },
];

async function main() {
  // load .env.local
  try {
    require("dotenv").config({ path: ".env.local" });
  } catch {}
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const a of APPS) {
    const { error } = await supabase
      .from("apps")
      .upsert(a, { onConflict: "app_slug" });
    if (error) {
      console.error("seed failed", a.app_slug, error.message);
      process.exit(1);
    }
    console.log("seeded", a.app_slug);
  }
  console.log(`Done. ${APPS.length} apps.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
