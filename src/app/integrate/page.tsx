export const dynamic = "force-dynamic";

const ANALYTICS_URL = "https://app-analytics-mxf.vercel.app";

const SNIPPET_FETCH = `// Drop this in any app. Calls /api/track on app-analytics-mxf.
const ANALYTICS_URL = process.env.NEXT_PUBLIC_APP_ANALYTICS_URL ||
  "https://app-analytics-mxf.vercel.app";

export async function trackAppEvent(input: {
  app_slug: string;
  event_name: string;
  event_type?: string;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}): Promise<void> {
  try {
    await fetch(\`\${ANALYTICS_URL}/api/track\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {}
}

// trackAppEvent({ app_slug: "finance-mxf", event_name: "app_opened", event_type: "usage" });
`;

const SNIPPET_POSTHOG = `// Add PostHog to any app, then PostHog forwards events here.
// 1) npm i posthog-js
// 2) In your app:
import posthog from "posthog-js";

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    autocapture: true,
    capture_pageview: true,
  });
  // ALWAYS attach app_slug so this dashboard can map events to apps.
  posthog.register({ app_slug: "finance-mxf" });
}

// Custom events:
posthog.capture("recommendation_accepted", { decision_id: 42 });
`;

const EVENT_TAXONOMY = [
  "app_opened",
  "page_viewed",
  "report_viewed",
  "recommendation_generated",
  "recommendation_accepted",
  "recommendation_ignored",
  "email_sent",
  "task_created",
  "decision_logged",
  "feedback_submitted",
];

export default function IntegratePage() {
  return (
    <div className="container-narrow">
      <h1 className="serif" style={{ fontSize: 28, margin: "0 0 8px" }}>Integrate</h1>
      <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
        Two ways to feed this dashboard. Pick one per app, or use both.
      </p>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Option A — direct fetch</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>Cheapest. One function, one POST per event.</div>
        <pre className="snippet">{SNIPPET_FETCH}</pre>
        <details style={{ marginTop: 12 }}>
          <summary>curl</summary>
          <pre className="snippet" style={{ marginTop: 8 }}>{`curl -X POST ${ANALYTICS_URL}/api/track \\
  -H 'content-type: application/json' \\
  -d '{ "app_slug": "finance-mxf", "event_name": "app_opened", "event_type": "usage" }'`}</pre>
        </details>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Option B — PostHog</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>
          Use PostHog for autocapture, session replay, funnels. PostHog mirrors events here via webhook,
          so this dashboard stays the single portfolio view.
        </div>
        <div style={{ fontSize: 14, fontFamily: "var(--font-display)", marginBottom: 8 }}>1. Add the SDK</div>
        <pre className="snippet">{SNIPPET_POSTHOG}</pre>
        <div style={{ fontSize: 14, fontFamily: "var(--font-display)", margin: "16px 0 8px" }}>2. Forward events to this dashboard</div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
          In PostHog → <em>Data pipeline → Destinations → New destination → Webhook</em>:
        </div>
        <pre className="snippet">{`URL:     ${ANALYTICS_URL}/api/posthog/webhook?token=YOUR_POSTHOG_WEBHOOK_SECRET
Method:  POST
Format:  PostHog JSON (default)
Filter:  (optional) limit to events where app_slug is set
`}</pre>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          The endpoint dedupes on PostHog&apos;s event UUID and looks up the app by
          <code> properties.app_slug</code>. You can also pin one app per webhook by adding
          <code> &amp;app_slug=finance-mxf</code> to the URL.
        </div>
      </section>

      <section className="card">
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>Standard event taxonomy</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>Use these names regardless of which integration path you pick.</div>
        <ul style={{ paddingLeft: 18, margin: 0, columns: 2, fontSize: 14 }}>
          {EVENT_TAXONOMY.map((e) => <li key={e} style={{ padding: "2px 0" }}><code>{e}</code></li>)}
        </ul>
      </section>
    </div>
  );
}
