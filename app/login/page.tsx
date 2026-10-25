"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { getClient } from "@/lib/supabase";

const friendly = (m: string) => (/fetch|network|load failed/i.test(m) ? "Can't reach the server. Check your connection and try again." : m);

export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (mode === "up" && password.length < 8) { setMessage({ kind: "error", text: "Use at least 8 characters for the password." }); return; }
    setBusy(true);
    try {
      const sb = getClient();
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setMessage({ kind: "error", text: friendly(error.message) });
        // on success the gate notices the new session and moves to Home
      } else {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) setMessage({ kind: "error", text: friendly(error.message) });
        else if (!data.session) setMessage({ kind: "info", text: "Account created. Open the email we sent and confirm it, then sign in." });
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? friendly(err.message) : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-margin pt-16">
      <h1 className="text-2xl font-semibold">Lift Log</h1>
      <p className="mt-1 text-sm text-muted">{mode === "in" ? "Sign in to see your routines and history." : "Create your account."}</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="text-sm text-muted" htmlFor="email">Email
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-base text-text" />
        </label>
        <label className="text-sm text-muted" htmlFor="password">Password
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-base text-text" />
        </label>
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"}
            className={`rounded-md px-4 py-3 text-sm ${message.kind === "error" ? "bg-surface text-danger" : "bg-success-surface text-text"}`}>
            {message.text}
          </p>
        )}
        <Button variant="primary" size="lg" block type="submit" disabled={busy}>
          {busy ? "Please wait..." : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <button type="button" className="mt-6 h-11 text-sm text-accent" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMessage(null); }}>
        {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
