"use client";

import { Download, LogOut, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, PageHeader, Toast } from "@/components/ui";
import { useAsync } from "@/lib/hooks";
import { exportBackup, getSettings, importBackup, listRoutines, listWorkouts, saveSettings } from "@/lib/store";
import { getClient, REMOTE } from "@/lib/supabase";
import { DEFAULT_SETTINGS } from "@/lib/types";
import type { Routine, Settings, Workout } from "@/lib/types";

export default function Profile() {
  const settings = useAsync(getSettings, DEFAULT_SETTINGS);
  const workouts = useAsync(listWorkouts, [] as Workout[]);
  const routines = useAsync(listRoutines, [] as Routine[]);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (REMOTE) void getClient().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const patch = async (p: Partial<Settings>) => { await saveSettings({ ...settings.data, ...p }); settings.reload(); };

  async function download() {
    const text = await exportBackup();
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lift-log-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    say("Backup downloaded. Keep it somewhere safe.");
  }

  async function upload(file: File) {
    const r = await importBackup(await file.text());
    if (!r.ok) { say(r.error); return; }
    say(`Restored ${r.workouts} workouts and ${r.routines} routines.`);
    settings.reload(); workouts.reload(); routines.reload();
  }

  return (
    <main>
      <PageHeader title="Profile" />
      <div className="px-margin">
        <dl className="flex gap-8">
          <div><dt className="text-xs text-muted">Workouts</dt><dd className="tnum text-lg">{workouts.data.length}</dd></div>
          <div><dt className="text-xs text-muted">Routines</dt><dd className="tnum text-lg">{routines.data.length}</dd></div>
        </dl>

        <h2 className="mt-8 text-base">Settings</h2>
        <div className="mt-3 flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm text-muted">Weight unit</legend>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Weight unit">
              {(["kg", "lb"] as const).map((u) => (
                <button key={u} type="button" role="radio" aria-checked={settings.data.units === u} onClick={() => patch({ units: u })}
                  className={`h-9 rounded-pill px-5 text-sm font-semibold ${settings.data.units === u ? "bg-accent text-on-accent" : "bg-surface text-text"}`}>{u}</button>
              ))}
            </div>
          </fieldset>
          <label className="text-sm text-muted">Default rest timer (seconds)
            <input inputMode="numeric" defaultValue={settings.data.defaultRestSeconds} key={settings.data.defaultRestSeconds}
              onBlur={(e) => { const n = Math.min(1800, Math.max(0, Math.round(Number(e.target.value) || 0))); void patch({ defaultRestSeconds: n }); }}
              className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text" />
          </label>
        </div>

        {REMOTE && (
          <>
            <h2 className="mt-8 text-base">Account</h2>
            <p className="mt-1 text-sm text-muted">{email ? `Signed in as ${email}` : "Signed in"}</p>
            <Button variant="secondary" size="lg" block className="mt-3" onClick={() => void getClient().auth.signOut()}>
              <LogOut size={20} aria-hidden="true" /> Sign out
            </Button>
          </>
        )}

        <h2 className="mt-8 text-base">Backup</h2>
        <p className="mt-1 text-sm text-muted">
          {REMOTE
            ? "Your data is saved in your account. A backup file is still worth keeping now and then. Restoring adds the file's contents to your account; it never deletes anything."
            : "Your data lives in this browser. If the browser clears it, it is gone. Download a backup now and then, and restore it here or on another device."}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Button variant="secondary" size="lg" block onClick={download}><Download size={20} aria-hidden="true" /> Download backup</Button>
          <Button variant="secondary" size="lg" block onClick={() => fileRef.current?.click()}><Upload size={20} aria-hidden="true" /> Restore from backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose backup file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </div>
      </div>
      <Toast message={toast} />
    </main>
  );
}
