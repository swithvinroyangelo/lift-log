"use client";

import { ArrowDown, ArrowUp, ChevronLeft, MoreVertical, Plus, Repeat, Timer, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { SetTable } from "@/components/set-table";
import { Button, ConfirmDialog, ExerciseThumb, IconButton, Sheet, SheetRow, Toast } from "@/components/ui";
import { newId } from "@/lib/ids";
import { useSettings } from "@/lib/hooks";
import { deleteRoutine, getRoutine, listExercises, listWorkouts, saveRoutine } from "@/lib/store";
import type { Exercise, Routine, RoutineExercise } from "@/lib/types";

const REST_CHOICES: { label: string; value: number | null }[] = [
  { label: "Use my default", value: null }, { label: "Off", value: 0 }, { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 }, { label: "1 minute 30", value: 90 }, { label: "2 minutes", value: 120 },
  { label: "3 minutes", value: 180 }, { label: "5 minutes", value: 300 },
];

function restText(v: number | null, fallback: number): string {
  const s = v === null ? fallback : v;
  if (s === 0) return "off";
  const t = s >= 60 ? `${Math.floor(s / 60)}min ${s % 60}s` : `${s}s`;
  return v === null ? `${t} (default)` : t;
}

export default function RoutineEditor() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const settings = useSettings();
  const isNew = params.id === "new";
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState<null | "add" | string>(null); // "add" or the id of the block being replaced
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const refreshExercises = useCallback(async () => setExercises(await listExercises()), []);

  useEffect(() => {
    (async () => {
      setExercises(await listExercises());
      const hist = await listWorkouts();
      const seen: string[] = [];
      for (const w of hist) for (const e of w.exercises) if (!seen.includes(e.exerciseId)) seen.push(e.exerciseId);
      setRecentIds(seen);
      if (isNew) {
        setRoutine({ id: newId(), name: "", notes: "", exercises: [], updatedAt: new Date().toISOString() });
      } else {
        const r = await getRoutine(params.id);
        if (r) setRoutine(r); else setMissing(true);
      }
    })();
  }, [isNew, params.id]);

  const byId = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);

  if (missing) return <main className="p-margin"><p>That routine no longer exists.</p><Button variant="primary" className="mt-4" onClick={() => router.replace("/workout")}>Back to routines</Button></main>;
  if (!routine) return <main className="p-margin text-muted">Loading...</main>;

  const update = (fn: (r: Routine) => Routine) => setRoutine((r) => (r ? fn(r) : r));
  const updateEx = (id: string, fn: (e: RoutineExercise) => RoutineExercise) =>
    update((r) => ({ ...r, exercises: r.exercises.map((e) => (e.id === id ? fn(e) : e)) }));

  function move(id: string, dir: -1 | 1) {
    update((r) => {
      const i = r.exercises.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= r.exercises.length) return r;
      const list = [...r.exercises];
      const a = list[i]!, b = list[j]!;
      list[i] = b; list[j] = a;
      return { ...r, exercises: list };
    });
  }

  async function save() {
    if (!routine) return;
    const name = routine.name.trim();
    if (!name) { setToast("Give the routine a name."); setTimeout(() => setToast(null), 2500); return; }
    await saveRoutine({ ...routine, name });
    router.replace("/workout");
  }

  const menuEx = routine.exercises.find((e) => e.id === menuFor) ?? null;
  const menuIndex = menuEx ? routine.exercises.indexOf(menuEx) : -1;
  const restEx = routine.exercises.find((e) => e.id === restFor) ?? null;

  return (
    <main className="pb-16">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-surface px-margin pt-[env(safe-area-inset-top)]">
        <IconButton label="Back to routines" onClick={() => router.back()}><ChevronLeft size={26} aria-hidden="true" /></IconButton>
        <h1 className="flex-1 text-sm font-normal">{isNew ? "New Routine" : "Edit Routine"}</h1>
        <Button variant="primary" onClick={save}>Save</Button>
      </header>

      <div className="px-margin pt-4">
        <label className="text-sm text-muted" htmlFor="rname">Routine name</label>
        <input id="rname" value={routine.name} placeholder="For example: Push day"
          onChange={(e) => update((r) => ({ ...r, name: e.target.value }))}
          className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-base text-text placeholder:text-muted" />
        <label className="mt-3 block text-sm text-muted" htmlFor="rnotes">Notes (shown at the top of the workout)</label>
        <textarea id="rnotes" value={routine.notes} rows={2}
          onChange={(e) => update((r) => ({ ...r, notes: e.target.value }))}
          className="mt-1 w-full rounded-sm border border-border-input bg-surface px-3 py-2 text-text" />
      </div>

      {routine.exercises.map((ex) => {
        const info = byId[ex.exerciseId];
        return (
          <section key={ex.id} aria-label={info?.name ?? "Exercise"} className="mt-6">
            <div className="flex items-center gap-3 px-margin">
              <ExerciseThumb muscle={info?.muscle ?? "other"} size={44} />
              <h2 className="flex-1 text-base">{info?.name ?? "Unknown exercise"}</h2>
              <IconButton label={`Options for ${info?.name ?? "exercise"}`} onClick={() => setMenuFor(ex.id)}><MoreVertical size={22} aria-hidden="true" /></IconButton>
            </div>
            <div className="px-margin">
              <label className="sr-only" htmlFor={`rn-${ex.id}`}>Notes for {info?.name}</label>
              <input id={`rn-${ex.id}`} value={ex.notes} placeholder="Add notes here..."
                onChange={(e) => updateEx(ex.id, (x) => ({ ...x, notes: e.target.value }))}
                className="mt-2 h-11 w-full rounded-sm bg-transparent text-sm text-text placeholder:text-muted focus:bg-surface" />
              <button type="button" onClick={() => setRestFor(ex.id)} className="mb-3 flex h-11 items-center gap-2 text-sm text-accent">
                <Timer size={20} aria-hidden="true" /> Rest timer: {restText(ex.restSeconds, settings.defaultRestSeconds)}
              </button>
            </div>
            <SetTable mode="edit" units={settings.units} exerciseName={info?.name ?? "exercise"}
              rows={ex.sets.map((s, i) => ({ id: `${ex.id}-${i}`, ...s }))}
              onChange={(i, patch) => updateEx(ex.id, (x) => ({ ...x, sets: x.sets.map((s, k) => (k === i ? { ...s, type: patch.type ?? s.type, weightKg: patch.weightKg !== undefined ? patch.weightKg : s.weightKg, reps: patch.reps !== undefined ? patch.reps : s.reps } : s)) }))}
              onAdd={() => updateEx(ex.id, (x) => {
                const last = x.sets[x.sets.length - 1];
                return { ...x, sets: [...x.sets, { type: "normal", weightKg: last?.weightKg ?? null, reps: last?.reps ?? null }] };
              })}
              onRemove={(i) => updateEx(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== i) }))} />
          </section>
        );
      })}

      <div className="mt-8 flex flex-col gap-3 px-margin">
        <Button variant="secondary" size="lg" block onClick={() => setPickerOpen("add")}><Plus size={20} aria-hidden="true" /> Add Exercise</Button>
        {!isNew && <Button variant="danger" size="lg" block onClick={() => setConfirmDelete(true)}>Delete Routine</Button>}
      </div>

      <Toast message={toast} />

      <Sheet open={menuEx !== null} onClose={() => setMenuFor(null)} title="Exercise options">
        <div className="overflow-hidden rounded-md">
          <SheetRow icon={<ArrowUp size={22} aria-hidden="true" />} onClick={() => { if (menuEx && menuIndex > 0) move(menuEx.id, -1); setMenuFor(null); }}>Move up</SheetRow>
          <SheetRow icon={<ArrowDown size={22} aria-hidden="true" />} onClick={() => { if (menuEx && menuIndex < routine.exercises.length - 1) move(menuEx.id, 1); setMenuFor(null); }}>Move down</SheetRow>
          <SheetRow icon={<Repeat size={22} aria-hidden="true" />} onClick={() => { if (menuEx) setPickerOpen(menuEx.id); setMenuFor(null); }}>Replace Exercise</SheetRow>
          <SheetRow danger icon={<Trash2 size={22} aria-hidden="true" />}
            onClick={() => { if (menuEx) update((r) => ({ ...r, exercises: r.exercises.filter((e) => e.id !== menuEx.id) })); setMenuFor(null); }}>Remove Exercise</SheetRow>
        </div>
      </Sheet>

      <Sheet open={restEx !== null} onClose={() => setRestFor(null)} title="Rest timer length">
        <div className="max-h-[60dvh] overflow-y-auto rounded-md">
          {REST_CHOICES.map((c) => (
            <SheetRow key={c.label} onClick={() => { if (restEx) updateEx(restEx.id, (x) => ({ ...x, restSeconds: c.value })); setRestFor(null); }}>
              {c.label}{restEx && restEx.restSeconds === c.value ? " (current)" : ""}
            </SheetRow>
          ))}
        </div>
      </Sheet>

      <ExercisePicker open={pickerOpen !== null} title={pickerOpen && pickerOpen !== "add" ? "Replace Exercise" : "Add Exercise"}
        multi={pickerOpen === "add"} exercises={exercises} recentIds={recentIds}
        onClose={() => setPickerOpen(null)} onCreated={refreshExercises}
        onPick={(ids) => {
          if (pickerOpen && pickerOpen !== "add") {
            const target = pickerOpen;
            if (ids[0]) updateEx(target, (e) => ({ ...e, exerciseId: ids[0]! }));
          } else {
            update((r) => ({
              ...r,
              exercises: [...r.exercises, ...ids.map((id): RoutineExercise => ({
                id: newId(), exerciseId: id, restSeconds: null, notes: "", supersetGroup: null,
                sets: [{ type: "normal", weightKg: null, reps: null }, { type: "normal", weightKg: null, reps: null }, { type: "normal", weightKg: null, reps: null }],
              }))],
            }));
          }
          setPickerOpen(null);
        }} />

      <ConfirmDialog open={confirmDelete} danger title={`Delete ${routine.name || "this routine"}?`}
        body="Workouts you already did from it stay in your history." confirmLabel="Delete routine"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteRoutine(routine.id); router.replace("/workout"); }} />
    </main>
  );
}
