"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearCaches } from "@/lib/store-remote";
import { getClient, REMOTE, setCurrentUserId } from "@/lib/supabase";

type State = "loading" | "out" | "in";

/**
 * With Supabase on: nothing but /login is shown until someone is signed in.
 * Also shows one banner for any failed save or load, so a dropped connection is never silent.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [state, setState] = useState<State>(REMOTE ? "loading" : "in");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!REMOTE) return;
    const sb = getClient();
    void sb.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
      setState(data.session ? "in" : "out");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id ?? null);
      if (!session) clearCaches();
      setState(session ? "in" : "out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state === "out" && path !== "/login") router.replace("/login");
    if (state === "in" && path === "/login") router.replace("/");
  }, [state, path, router]);

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : "";
      if (msg) setProblem(/failed to fetch|networkerror|load failed/i.test(msg) ? "No connection to the server. Nothing was lost; try again when you have signal." : msg);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  const show = state === "in" ? path !== "/login" : state === "out" && path === "/login";
  return (
    <>
      {problem && (
        <div role="alert" className="sticky top-0 z-30 flex items-start gap-3 bg-danger px-margin py-3 text-sm text-on-accent">
          <span className="flex-1">{problem}</span>
          <button type="button" className="font-semibold underline" onClick={() => setProblem(null)}>Dismiss</button>
        </div>
      )}
      {show ? children : <main className="p-margin text-muted">Loading...</main>}
    </>
  );
}
