"use client";

import {
  ArrowDown, ArrowUp, ChevronDown, Link2, MoreVertical, Plus, Repeat, Timer, Trash2, Unlink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { RestTimerPanel } from "@/components/rest-timer-panel";
import { SetTable } from "@/components/set-table";
import { Button, ConfirmDialog, ExerciseThumb, IconButton, Sheet, SheetRow, Toast } from "@/components/ui";
import { useNow, useSettings } from "@/lib/hooks";
import {
  clearDraft, getRoutine, getWorkout, listExercises, listWorkouts, loadDraft, saveDraftNow, saveWorkout,
} from "@/lib/store";
import { formatVolume } from "@/lib/units";
import {
  completedSetCount, durationSeconds, emptyWorkout, finalizeWorkout, formatClock, newWorkoutExercise,
  newWorkoutSet, previousSets, totalSetCount, workoutFromRoutine, workoutVolumeKg,
} from "@/lib/workout-math";
import { newId } from "@/lib/ids";
import type { Exercise, RestTimer, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";

const REST_CHOICES: { label: string; value: number | null }[] = [
  { label: "Use my default", value: null },
  { label: "Off", value: 0 },
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "1 minute 30", value: 90 },
  { label: "2 minutes", value: 120 },
  { label: "3 minutes", value: 180 },
  { label: "5 minutes", value: 300 },
];

function restText(restSeconds: number | null, fallback: number): string {
  const s = restSeconds === null ? fallback : restSeconds;
  if (s === 0) return "off";
  const m = Math.floor(s / 60), r = s % 60;
  const t = m > 0 ? `${m}min ${r}s` : `${r}s`;
  return restSeconds === null ? `${t} (default)` : t;
}

export default function LiveWorkout() {
  const router = useRouter();
  const settings = useSettings();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [rest, setRest] = useState<RestTimer | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [history, setHistory] = useState<Workout[]>([]);
  const [loaded, setLoaded] = useState(false);
  const finished = useRef(false);

  const [picker, setPicker] = useState<null | { kind: "add" } | { kind: "replace"; exId: string }>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "finish" | "empty" | "discard">(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow(1000, loaded);

  const refreshExercises = useCallback(async () => setExercises(await listExercises()), []);

  // ---- load: resume the draft if there is one, otherwise start what the URL asked for
  useEffect(() => {
    (async () => {
      const [ex, hist, draft] = await Promise.all([listExercises(), listWorkouts(), loadDraft()]);
      setExercises(ex);
      setHistory(hist);
      if (draft) {
        setWorkout(draft.workout);
        setRest(draft.rest);
      } else {
        const params = new URLSearchParams(window.location.search);
        let w: Workout | null = null;
        const routineId = params.get("routine");
        const fromId = params.get("from");
        if (routineId) {
          const r = await getRoutine(routineId);
          if (r) w = workoutFromRoutine(r, hist);
        } else if (fromId) {
          const src = await getWorkout(fromId);
          if (src) {
            const startedAt = new Date().toISOString();
            w = {
              ...emptyWorkout(src.title), notes: src.notes, routineId: src.routineId, startedAt,
              exercises: src.exercises.map((e) => ({
                ...e, id: newId(),
                sets: e.sets.map((s) => ({ ...s, id: newId(), completed: false })),
              })),
            };
          }
        } else if (params.get("new") === "empty") {
          w = emptyWorkout("Workout");
        }
        if (!w) { router.replace("/workout"); return; }
        setWorkout(w);
        saveDraftNow({ workout: w, rest: null });
        window.history.replaceState(null, "", "/live");
      }
      setLoaded(true);
    })();
  }, [router]);

  // ---- save after every change
  useEffect(() => {
    if (!loaded || !workout || finished.current) return;
    saveDraftNow({ workout, rest });
  }, [workout, rest, loaded]);

  const byId = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises]);
  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (const w of history) for (const e of w.exercises) if (!seen.includes(e.exerciseId)) seen.push(e.exerciseId);
    return seen;
  }, [history]);

  const updateEx = (exId: string, fn: (e: WorkoutExercise) => WorkoutExercise) =>
    setWorkout((w) => (w ? { ...w, exercises: w.exercises.map((e) => (e.id === exId ? fn(e) : e)) } : w));

  const updateSet = (exId: string, i: number, patch: Partial<WorkoutSet>) =>
    updateEx(exId, (e) => ({ ...e, sets: e.sets.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));

  function toggleDone(ex: WorkoutExercise, i: number) {
    const s = ex.sets[i];
    if (!s) return;
    if (s.completed) { updateSet(ex.id, i, { completed: false }); return; }
    if (s.reps === null) { setToast("Enter the reps first."); setTimeout(() => setToast(null), 2500); return; }
    updateSet(ex.id, i, { completed: true });
    const secs = ex.restSeconds === null ? settings.defaultRestSeconds : ex.restSeconds;
    if (secs > 0) setRest({ endsAt: Date.now() + secs * 1000, totalSeconds: secs });
  }

  function move(exId: string, dir: -1 | 1) {
    setWorkout((w) => {
      if (!w) return w;
      const i = w.exercises.findIndex((e) => e.id === exId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= w.exercises.length) return w;
      const list = [...w.exercises];
      const a = list[i]!, b = list[j]!;
      list[i] = b; list[j] = a;
      return { ...w, exercises: list };
    });
  }

  function superset(exId: string) {
    setWorkout((w) => {
      if (!w) return w;
      const i = w.exercises.findIndex((e) => e.id === exId);
      const prev = w.exercises[i - 1];
      if (i <= 0 || !prev) return w;
      const group = prev.supersetGroup ?? Math.max(0, ...w.exercises.map((e) => e.supersetGroup ?? 0)) + 1;
      return { ...w, exercises: w.exercises.map((e) => (e.id === exId || e.id === prev.id ? { ...e, supersetGroup: group } : e)) };
    });
  }

  function unsuperset(exId: string) {
    setWorkout((w) => {
      if (!w) return w;
      const mine = w.exercises.find((e) => e.id === exId);
      const group = mine?.supersetGroup;
      const next = w.exercises.map((e) => (e.id === exId ? { ...e, supersetGroup: null } : e));
      // a group of one is not a superset
      const left = next.filter((e) => e.supersetGroup === group);
      return { ...w, exercises: next.map((e) => (left.length === 1 && e.supersetGroup === group ? { ...e, supersetGroup: null } : e)) };
    });
  }

  function addExercises(ids: string[]) {
    setWorkout((w) => {
      if (!w) return w;
      const added = ids.map((id) => newWorkoutExercise(id, previousSets(id, w.startedAt, history)));
      return { ...w, exercises: [...w.exercises, ...added] };
    });
    setPicker(null);
  }

  function replaceExercise(exId: string, newExerciseId: string) {
    updateEx(exId, (e) => ({ ...e, exerciseId: newExerciseId }));
    setPicker(null);
  }

  async function finish() {
    if (!workout) return;
    const done = finalizeWorkout(workout);
    if (!done) { setConfirm("empty"); return; }
    finished.current = true;
    try {
      await saveWorkout(done); // same id on a retry, so saving twice never duplicates
    } catch (e) {
      finished.current = false; // keep the draft alive: nothing is lost, the person can tap Finish again
      throw e;
    }
    await clearDraft();
    router.replace(`/history/${done.id}?done=1`);
  }

  function onFinishTapped() {
    if (!workout) return;
    const total = totalSetCount(workout);
    const anyDone = workout.exercises.some((e) => e.sets.some((s) => s.completed));
    if (!anyDone) { setConfirm("empty"); return; }
    const notDone = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
    if (notDone > 0 && total > 0) setConfirm("finish"); else void finish();
  }

  async function discard() {
    finished.current = true;
    await clearDraft();
    router.replace("/workout");
  }

  if (!loaded || !workout) return <main className="p-margin text-muted">Loading workout...</main>;

  const notDone = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
  const menuEx = workout.exercises.find((e) => e.id === menuFor) ?? null;
  const menuIndex = menuEx ? workout.exercises.indexOf(menuEx) : -1;
  const restEx = workout.exercises.find((e) => e.id === restFor) ?? null;

  return (
    <main className={rest ? "pb-[170px]" : "pb-10"}>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-surface px-margin pt-[env(safe-area-inset-top)]">
        <IconButton label="Minimise workout" onClick={() => router.push("/workout")}><ChevronDown size={26} aria-hidden="true" /></IconButton>
        <h1 className="flex-1 text-sm font-normal">Log Workout</h1>
        <Button variant="primary" onClick={onFinishTapped}>Finish</Button>
      </header>

      <section aria-label="Workout totals" className="grid grid-cols-3 gap-4 border-b border-border px-margin py-4">
        <div><p className="text-xs text-muted">Duration</p><p className="tnum text-base text-accent">{formatClock(durationSeconds(workout, now))}</p></div>
        <div><p className="text-xs text-muted">Volume</p><p className="tnum text-base">{formatVolume(workoutVolumeKg(workout), settings.units)}</p></div>
        <div><p className="text-xs text-muted">Sets</p><p className="tnum text-base">{completedSetCount(workout)}</p></div>
      </section>

      <div className="px-margin pt-4">
        <label className="sr-only" htmlFor="title">Workout name</label>
        <input id="title" value={workout.title} onChange={(e) => setWorkout({ ...workout, title: e.target.value })}
          className="h-11 w-full rounded-sm bg-transparent text-lg text-text focus:bg-surface" />
        {workout.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{workout.notes}</p>}
      </div>

      {workout.exercises.length === 0 && (
        <p className="px-margin py-10 text-center text-sm text-muted">No exercises yet. Add the first one below.</p>
      )}

      {workout.exercises.map((ex, idx) => {
        const info = byId[ex.exerciseId];
        const prev = previousSets(ex.exerciseId, workout.startedAt, history);
        const inSuperset = ex.supersetGroup !== null && workout.exercises.some((o) => o.id !== ex.id && o.supersetGroup === ex.supersetGroup);
        return (
          <section key={ex.id} aria-label={info?.name ?? "Exercise"} className="mt-6">
            <div className="flex items-center gap-3 px-margin">
              <ExerciseThumb muscle={info?.muscle ?? "other"} size={44} />
              <h2 className="flex-1 text-base text-accent">{info?.name ?? "Unknown exercise"}</h2>
              <IconButton label={`Options for ${info?.name ?? "exercise"}`} onClick={() => setMenuFor(ex.id)}>
                <MoreVertical size={22} aria-hidden="true" />
              </IconButton>
            </div>
            {inSuperset && <p className="px-margin pt-1 text-xs text-muted">Superset {idx > 0 && workout.exercises[idx - 1]?.supersetGroup === ex.supersetGroup ? "(with the one above)" : "(with the one below)"}</p>}
            <div className="px-margin">
              <label className="sr-only" htmlFor={`n-${ex.id}`}>Notes for {info?.name}</label>
              <input id={`n-${ex.id}`} value={ex.notes} placeholder="Add notes here..."
                onChange={(e) => updateEx(ex.id, (x) => ({ ...x, notes: e.target.value }))}
                className="mt-2 h-11 w-full rounded-sm bg-transparent text-sm text-text placeholder:text-muted focus:bg-surface" />
              <button type="button" onClick={() => setRestFor(ex.id)} className="mb-3 flex h-11 items-center gap-2 text-sm text-accent">
                <Timer size={20} aria-hidden="true" /> Rest timer: {restText(ex.restSeconds, settings.defaultRestSeconds)}
              </button>
            </div>
            <SetTable mode="live" units={settings.units} exerciseName={info?.name ?? "exercise"} previous={prev}
              rows={ex.sets}
              onChange={(i, patch) => updateSet(ex.id, i, patch)}
              onToggleDone={(i) => toggleDone(ex, i)}
              onAdd={() => updateEx(ex.id, (x) => {
                const last = x.sets[x.sets.length - 1];
                return { ...x, sets: [...x.sets, newWorkoutSet({ weightKg: last?.weightKg ?? null, reps: last?.reps ?? null })] };
              })}
              onRemove={(i) => updateEx(ex.id, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== i) }))} />
          </section>
        );
      })}

      <div className="mt-8 flex flex-col gap-3 px-margin">
        <Button variant="secondary" size="lg" block onClick={() => setPicker({ kind: "add" })}>
          <Plus size={20} aria-hidden="true" /> Add Exercise
        </Button>
        <Button variant="danger" size="lg" block onClick={() => setConfirm("discard")}>Discard Workout</Button>
      </div>

      {rest && <RestTimerPanel rest={rest} onChange={setRest} />}
      <Toast message={toast} />

      <Sheet open={menuEx !== null} onClose={() => setMenuFor(null)} title="Exercise options">
        <div className="overflow-hidden rounded-md">
          <SheetRow icon={<ArrowUp size={22} aria-hidden="true" />} onClick={() => { if (menuEx && menuIndex > 0) move(menuEx.id, -1); setMenuFor(null); }}>Move up</SheetRow>
          <SheetRow icon={<ArrowDown size={22} aria-hidden="true" />} onClick={() => { if (menuEx && menuIndex < workout.exercises.length - 1) move(menuEx.id, 1); setMenuFor(null); }}>Move down</SheetRow>
          <SheetRow icon={<Repeat size={22} aria-hidden="true" />} onClick={() => { if (menuEx) setPicker({ kind: "replace", exId: menuEx.id }); setMenuFor(null); }}>Replace Exercise</SheetRow>
          {menuEx && menuEx.supersetGroup !== null ? (
            <SheetRow icon={<Unlink size={22} aria-hidden="true" />} onClick={() => { unsuperset(menuEx.id); setMenuFor(null); }}>Remove from superset</SheetRow>
          ) : (
            <SheetRow icon={<Link2 size={22} aria-hidden="true" />} onClick={() => { if (menuEx && menuIndex > 0) superset(menuEx.id); else setToast("Add it below another exercise to make a superset."); setMenuFor(null); setTimeout(() => setToast(null), 2500); }}>Superset with the exercise above</SheetRow>
          )}
          <SheetRow danger icon={<Trash2 size={22} aria-hidden="true" />}
            onClick={() => { if (menuEx) setWorkout({ ...workout, exercises: workout.exercises.filter((e) => e.id !== menuEx.id) }); setMenuFor(null); }}>
            Remove Exercise
          </SheetRow>
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

      <ExercisePicker
        open={picker !== null}
        title={picker?.kind === "replace" ? "Replace Exercise" : "Add Exercise"}
        multi={picker?.kind !== "replace"}
        exercises={exercises} recentIds={recentIds}
        onClose={() => setPicker(null)}
        onCreated={refreshExercises}
        onPick={(ids) => {
          if (picker?.kind === "replace" && ids[0]) replaceExercise(picker.exId, ids[0]);
          else addExercises(ids);
        }} />

      <ConfirmDialog open={confirm === "finish"} title="Finish workout?"
        body={`${notDone} set${notDone === 1 ? " is" : "s are"} not done and will be left out of your history.`}
        confirmLabel="Finish anyway" cancelLabel="Keep going"
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void finish(); }} />
      <ConfirmDialog open={confirm === "empty"} danger title="Nothing logged yet"
        body="No set is marked done, so there is nothing to save. Discard this workout?"
        confirmLabel="Discard workout" cancelLabel="Keep going"
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void discard(); }} />
      <ConfirmDialog open={confirm === "discard"} danger title="Discard this workout?"
        body="Everything you logged in it will be lost."
        confirmLabel="Discard workout" cancelLabel="Keep going"
        onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); void discard(); }} />
    </main>
  );
}
