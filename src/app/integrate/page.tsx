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
        Two ways to feed this dashboard. Pick one per app.
      </p>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Option A — direct fetch</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>One function, one POST per event. Cheapest path.</div>
        <pre className="snippet">{SNIPPET_FETCH}</pre>
        <details style={{ marginTop: 12 }}>
          <summary>curl</summary>
          <pre className="snippet" style={{ marginTop: 8 }}>{`curl -X POST ${ANALYTICS_URL}/api/track \\
  -H 'content-type: application/json' \\
  -d '{ "app_slug": "finance-mxf", "event_name": "app_opened", "event_type": "usage" }'`}</pre>
        </details>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Option B — PostHog webhook</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>
          If the app already sends to PostHog, add a Webhook destination pointing here.
        </div>
        <pre className="snippet">{`URL:    ${ANALYTICS_URL}/api/posthog/webhook?token=$POSTHOG_WEBHOOK_SECRET
Method: POST`}</pre>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          Maps events by <code>properties.app_slug</code>, or pin one app per webhook with
          <code> &amp;app_slug=&lt;slug&gt;</code>. Dedupes on PostHog event uuid.
        </div>
      </section>

      <section className="card">
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>Standard event taxonomy</div>
        <ul style={{ paddingLeft: 18, margin: 0, columns: 2, fontSize: 14 }}>
          {EVENT_TAXONOMY.map((e) => <li key={e} style={{ padding: "2px 0" }}><code>{e}</code></li>)}
        </ul>
      </section>
    </div>
  );
}
