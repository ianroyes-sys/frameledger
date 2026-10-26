"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
export type LiveSession = {
  token: string;
  businessId: string;
  signOut: () => Promise<void>;
};
export default function LiveGate({
  children,
}: {
  children: (session: LiveSession) => ReactNode;
}) {
  const [client] = useState<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && key
      ? createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
      : null;
  });
  const [session, setSession] = useState<{
    token: string;
    businessId: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (next) setSession((s) => (s ? { ...s, token: next.access_token } : s));
      else setSession(null);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = createAccount
        ? await client.auth.signUp({ email, password })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw new Error(result.error.message);
      if (!result.data.session) {
        setMessage(
          "Check your email to confirm your account, then return here to sign in.",
        );
        setCreateAccount(false);
        return;
      }
      const token = result.data.session.access_token;
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const response = await fetch("/api/businesses", {
        headers,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not load your businesses.");
      let businessId = data.businesses?.[0]?.id;
      if (!businessId) {
        if (!businessName.trim())
          throw new Error(
            "Enter your business name to create your first workspace.",
          );
        const created = await fetch("/api/businesses", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: businessName.trim() }),
        });
        const payload = await created.json();
        if (!created.ok)
          throw new Error(payload.error ?? "Could not create your workspace.");
        businessId = payload.businessId;
      }
      if (typeof businessId !== "string")
        throw new Error("The workspace response was incomplete. Please retry.");
      setSession({ token, businessId });
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign-in failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (session)
    return children({
      ...session,
      signOut: async () => {
        await client?.auth.signOut();
        setSession(null);
      },
    });
  return (
    <main className="auth-page">
      <aside className="auth-story" aria-label="About FrameLedger">
        <div className="brand">
          <span className="brandmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          FrameLedger
        </div>
        <h2>
          Make good work.
          <br />
          Know what it earns.
        </h2>
        <p>
          A financial workspace for the projects you make, the people you work
          with, and the business you’re building.
        </p>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-sheet">
            <span>PROJECT WALLET</span>
            <strong>
              From the
              <br />
              first brief.
            </strong>
            <i />
            <i />
            <i />
          </div>
          <div className="auth-sheet">
            <span>FINANCIAL CLARITY</span>
            <strong>
              To the
              <br />
              final balance.
            </strong>
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="auth-foot">INDEPENDENT WORK. CONNECTED FINANCES.</div>
      </aside>
      <div className="auth-form-wrap">
        <section className="auth-form">
          <div className="brand">FrameLedger</div>
          <p className="eyebrow">Your business workspace</p>
          {process.env.NEXT_PUBLIC_APP_STAGE === "staging" && (
            <div className="callout" role="status">
              Non-commercial evaluation. Financial services are not connected.
              Use synthetic business records only.
            </div>
          )}
          <h1>
            {createAccount
              ? "Make room for your next chapter."
              : "Welcome back."}
          </h1>
          <p className="subtitle">
            Sign in to your private creative business workspace.
          </p>
          {!client ? (
            <div className="callout" role="status">
              Live access needs Supabase configuration. Set
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
              rebuild. No demo records are loaded in this environment.
            </div>
          ) : (
            <form onSubmit={submit} className="formgrid">
              <label>
                Email
                <input
                  aria-label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  aria-label="Password"
                  type="password"
                  minLength={createAccount ? 12 : 1}
                  autoComplete={
                    createAccount ? "new-password" : "current-password"
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                Business name{" "}
                <span className="muted">(for a new workspace)</span>
                <input
                  aria-label="Business name"
                  autoComplete="organization"
                  maxLength={100}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </label>
              {error && (
                <div role="alert" className="callout">
                  {error}
                </div>
              )}
              {message && (
                <div role="status" className="callout">
                  {message}
                </div>
              )}
              <button className="btn primary" type="submit" disabled={busy}>
                {busy
                  ? "Connecting…"
                  : createAccount
                    ? "Create account"
                    : "Sign in"}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  setCreateAccount(!createAccount);
                  setError("");
                }}
              >
                {createAccount
                  ? "Already have an account? Sign in"
                  : "Create a new account"}
              </button>
            </form>
          )}
          <p className="muted" style={{ marginTop: 24 }}>
            Account access does not activate financial services. Whop
            verification and account provisioning are separate required steps.
          </p>
        </section>
      </div>
    </main>
  );
}
