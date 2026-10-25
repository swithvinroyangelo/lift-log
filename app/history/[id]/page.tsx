"use client";

import { ChevronLeft, Medal, Pencil, Plus, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { SetTable } from "@/components/set-table";
import { Button, ConfirmDialog, ExerciseThumb, IconButton, Sheet, Toast } from "@/components/ui";
import { useSettings } from "@/lib/hooks";
import {
  deleteWorkout, getExerciseMap, getWorkout, listExercises, listWorkouts, saveRoutine, saveWorkout,
} from "@/lib/store";
import { formatVolume, formatWeight } from "@/lib/units";
import {
  completedSetCount, countRecords, durationSeconds, formatDurationShort, newWorkoutExercise, newWorkoutSet,
  relativeDay, routineFromWorkout, setLabel, workoutVolumeKg,
} from "@/lib/workout-math";
import type { Exercise, Workout } from "@/lib/types";

export default function WorkoutDetail() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const settings = useSettings();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [all, setAll] = useState<Workout[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [namingRoutine, setNamingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null); // the copy being edited; null when just viewing
  const [picking, setPicking] = useState(false);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };

  const load = useCallback(async () => {
    const [w, list, map, ex] = await Promise.all([getWorkout(id), listWorkouts(), getExerciseMap(), listExercises()]);
    if (!w) { setMissing(true); return; }
    setWorkout(w); setAll(list); setExerciseMap(map); setExerciseList(ex); setRoutineName(w.title);
  }, [id]);

  useEffect(() => {
    setJustFinished(new URLSearchParams(window.location.search).get("done") === "1");
    void load();
  }, [load]);

  const recentIds = useMemo(() => {
    const seen: string[] = [];
    for (const w of all) for (const e of w.exercises) if (!seen.includes(e.exerciseId)) seen.push(e.exerciseId);
    return seen;
  }, [all]);

  if (missing) return <main className="p-margin"><p>That workout no longer exists.</p><Button variant="primary" className="mt-4" onClick={() => router.replace("/")}>Back home</Button></main>;
  if (!workout) return <main className="p-margin text-muted">Loading...</main>;
  const units = settings.units;
  const shown = draft ?? workout;
  const editing = draft !== null;
  const records = countRecords(workout, all);

  const updateDraft = (fn: (w: Workout) => Workout) => setDraft((d) => (d ? fn(d) : d));

  async function saveEdit() {
    if (!draft) return;
    // blank sets (no weight and no reps) are dropped; exercises left with no sets are dropped
    const cleaned: Workout = {
      ...draft,
      title: draft.title.trim() || "Workout",
      exercises: draft.exercises
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.weightKg !== null || s.reps !== null).map((s) => ({ ...s, completed: true })) }))
        .filter((e) => e.sets.length > 0),
    };
    if (cleaned.exercises.length === 0) { say("A workout needs at least one set. Delete the workout instead."); return; }
    await saveWorkout(cleaned);
    setDraft(null);
    await load();
    say("Changes saved.");
  }

  return (
    <main className="pb-10">
      <header className="flex h-14 items-center gap-2 bg-bg px-margin pt-[env(safe-area-inset-top)]">
        <IconButton label="Back" onClick={() => (editing ? setDraft(null) : router.push("/"))}><ChevronLeft size={26} aria-hidden="true" /></IconButton>
        <h1 className="flex-1 truncate text-base">{editing ? "Edit Workout" : workout.title}</h1>
        {editing ? (
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit}>Save</Button>
          </>
        ) : (
          <>
            <IconButton label="Edit workout" onClick={() => setDraft(structuredClone(workout))}><Pencil size={22} aria-hidden="true" /></IconButton>
            <IconButton label="Delete workout" onClick={() => setConfirmDelete(true)}><Trash2 size={22} aria-hidden="true" /></IconButton>
          </>
        )}
      </header>

      <div className="px-margin">
        {justFinished && !editing && <p role="status" className="mb-3 rounded-md bg-success-surface px-4 py-3 text-sm">Workout saved.</p>}
        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="text-sm text-muted" htmlFor="wtitle">Workout name
              <input id="wtitle" value={shown.title} onChange={(e) => updateDraft((w) => ({ ...w, title: e.target.value }))}
                className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-base text-text" />
            </label>
            <label className="text-sm text-muted" htmlFor="wnotes">Notes
              <textarea id="wnotes" rows={2} value={shown.notes} onChange={(e) => updateDraft((w) => ({ ...w, notes: e.target.value }))}
                className="mt-1 w-full rounded-sm border border-border-input bg-surface px-3 py-2 text-text" />
            </label>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted">{relativeDay(workout.startedAt)}</p>
            <dl className="mt-3 flex gap-8">
              <div><dt className="text-xs text-muted">Time</dt><dd className="tnum text-sm font-semibold">{formatDurationShort(durationSeconds(workout))}</dd></div>
              <div><dt className="text-xs text-muted">Volume</dt><dd className="tnum text-sm font-semibold">{formatVolume(workoutVolumeKg(workout), units)}</dd></div>
              <div><dt className="text-xs text-muted">Sets</dt><dd className="tnum text-sm font-semibold">{completedSetCount(workout)}</dd></div>
              <div><dt className="text-xs text-muted">Records</dt><dd className="tnum flex items-center gap-1 text-sm font-semibold"><Medal size={16} className="text-record" aria-hidden="true" />{records}</dd></div>
            </dl>
            {workout.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{workout.notes}</p>}
          </>
        )}
      </div>

      {shown.exercises.map((ex) => {
        const info = exerciseMap[ex.exerciseId];
        return (
          <section key={ex.id} aria-label={info?.name ?? "Exercise"} className="mt-6">
            <div className="flex items-center gap-3 px-margin">
              <ExerciseThumb muscle={info?.muscle ?? "other"} size={44} />
              <h2 className="flex-1 text-base">{info?.name ?? "Unknown exercise"}</h2>
              {editing && (
                <IconButton label={`Remove ${info?.name ?? "exercise"}`}
                  onClick={() => updateDraft((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== ex.id) }))}>
                  <Trash2 size={22} aria-hidden="true" />
                </IconButton>
              )}
            </div>
            {editing ? (
              <>
                <div className="px-margin">
                  <label className="sr-only" htmlFor={`hn-${ex.id}`}>Notes for {info?.name}</label>
                  <input id={`hn-${ex.id}`} value={ex.notes} placeholder="Add notes here..."
                    onChange={(e) => updateDraft((w) => ({ ...w, exercises: w.exercises.map((x) => (x.id === ex.id ? { ...x, notes: e.target.value } : x)) }))}
                    className="my-2 h-11 w-full rounded-sm bg-transparent text-sm text-text placeholder:text-muted focus:bg-surface" />
                </div>
                <SetTable mode="edit" units={units} exerciseName={info?.name ?? "exercise"} rows={ex.sets}
                  onChange={(i, patch) => updateDraft((w) => ({ ...w, exercises: w.exercises.map((x) => (x.id !== ex.id ? x : {
                    ...x, sets: x.sets.map((s, k) => (k === i ? {
                      ...s,
                      type: patch.type ?? s.type,
                      weightKg: patch.weightKg !== undefined ? patch.weightKg : s.weightKg,
                      reps: patch.reps !== undefined ? patch.reps : s.reps,
                    } : s)),
                  })) }))}
                  onAdd={() => updateDraft((w) => ({ ...w, exercises: w.exercises.map((x) => {
                    if (x.id !== ex.id) return x;
                    const last = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, newWorkoutSet({ completed: true, weightKg: last?.weightKg ?? null, reps: last?.reps ?? null })] };
                  }) }))}
                  onRemove={(i) => updateDraft((w) => ({ ...w, exercises: w.exercises.map((x) => (x.id === ex.id ? { ...x, sets: x.sets.filter((_, k) => k !== i) } : x)) }))} />
              </>
            ) : (
              <>
                {ex.notes && <p className="px-margin pt-2 text-sm text-muted">{ex.notes}</p>}
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-2xs uppercase tracking-wide text-muted">
                      <th scope="col" className="px-margin py-1 text-left font-normal">Set</th>
                      <th scope="col" className="py-1 text-right font-normal">{units}</th>
                      <th scope="col" className="px-margin py-1 text-right font-normal">Reps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 1 ? "bg-surface" : ""}>
                        <th scope="row" className={`h-[var(--set-row-height)] px-margin text-left font-semibold ${s.type === "warmup" ? "text-warmup" : ""}`}>{setLabel(ex.sets, i)}</th>
                        <td className="tnum text-right font-semibold">{formatWeight(s.weightKg, units)}</td>
                        <td className="tnum px-margin text-right font-semibold">{s.reps ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        );
      })}

      <div className="mt-8 flex flex-col gap-3 px-margin">
        {editing ? (
          <Button variant="secondary" size="lg" block onClick={() => setPicking(true)}><Plus size={20} aria-hidden="true" /> Add Exercise</Button>
        ) : (
          <>
            <Button variant="primary" size="lg" block onClick={() => router.push(`/live?from=${workout.id}`)}>Do this workout again</Button>
            <Button variant="secondary" size="lg" block onClick={() => setNamingRoutine(true)}>Save as routine</Button>
          </>
        )}
      </div>

      <Toast message={toast} />

      <ExercisePicker open={picking} title="Add Exercise" multi exercises={exerciseList} recentIds={recentIds}
        onClose={() => setPicking(false)} onCreated={() => void load()}
        onPick={(ids) => {
          updateDraft((w) => ({ ...w, exercises: [...w.exercises, ...ids.map((eid) => {
            const ex = newWorkoutExercise(eid, []);
            return { ...ex, sets: ex.sets.map((s) => ({ ...s, completed: true })) };
          })] }));
          setPicking(false);
        }} />

      <Sheet open={namingRoutine} onClose={() => setNamingRoutine(false)} title="Save as routine">
        <form className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const name = routineName.trim();
          if (!name) return;
          await saveRoutine(routineFromWorkout(workout, name));
          setNamingRoutine(false);
          say("Routine saved.");
        }}>
          <label className="text-sm text-muted">Routine name
            <input value={routineName} onChange={(e) => setRoutineName(e.target.value)}
              className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text" />
          </label>
          <Button variant="primary" size="lg" block type="submit">Save routine</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={confirmDelete} danger title="Delete this workout?" body="It is removed from your history for good."
        confirmLabel="Delete workout" onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { await deleteWorkout(workout.id); router.replace("/"); }} />
    </main>
  );
}
