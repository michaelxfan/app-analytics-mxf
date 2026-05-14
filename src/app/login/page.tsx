import { redirect } from "next/navigation";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = String(formData.get("next") ?? "/");
  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password required")}&next=${encodeURIComponent(nextPath)}`);
  }
  const supabase = await supabaseRouteClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`);
  }
  redirect(nextPath || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const nextPath = sp.next ?? "/";
  const error = sp.error;

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form
        action={signIn}
        className="card"
        style={{ width: "100%", maxWidth: 380, padding: 32 }}
      >
        <div className="serif" style={{ fontSize: 22, marginBottom: 4 }}>App Analytics</div>
        <div className="muted tiny" style={{ marginBottom: 24 }}>Sign in to continue.</div>

        <label className="tiny" style={{ display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface)",
            fontSize: 14,
            marginBottom: 16,
          }}
        />

        <label className="tiny" style={{ display: "block", marginBottom: 4 }}>Password</label>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--surface)",
            fontSize: 14,
            marginBottom: 20,
          }}
        />

        <input type="hidden" name="next" value={nextPath} />

        {error && (
          <div
            className="tiny"
            style={{
              color: "var(--bad-text)",
              background: "var(--bad-bg)",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "var(--accent)",
            color: "#f5f1e6",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
