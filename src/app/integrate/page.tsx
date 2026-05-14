export const dynamic = "force-dynamic";

const SNIPPET = `// Drop this in any of your apps. Calls /api/track on app-analytics-mxf.
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
  } catch {
    // never throw from analytics
  }
}

// Example: trackAppEvent({ app_slug: "finance-mxf", event_name: "app_opened", event_type: "usage", metadata: {} });
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
        Drop one function into each app, call it where attention or outcomes happen.
      </p>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>Client snippet</div>
        <pre className="snippet">{SNIPPET}</pre>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>POST /api/track</div>
        <pre className="snippet">{`curl -X POST https://app-analytics-mxf.vercel.app/api/track \\
  -H 'content-type: application/json' \\
  -d '{ "app_slug": "finance-mxf", "event_name": "app_opened", "event_type": "usage", "metadata": {} }'`}</pre>
      </section>

      <section className="card">
        <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>Standard event taxonomy</div>
        <div className="muted tiny" style={{ marginBottom: 12 }}>Use these to keep dashboards comparable across apps.</div>
        <ul style={{ paddingLeft: 18, margin: 0, columns: 2, fontSize: 14 }}>
          {EVENT_TAXONOMY.map((e) => <li key={e} style={{ padding: "2px 0" }}><code>{e}</code></li>)}
        </ul>
      </section>
    </div>
  );
}
