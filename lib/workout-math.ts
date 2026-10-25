import { newId } from "./ids";
import type {
  Routine, SetType, Workout, WorkoutExercise, WorkoutSet,
} from "./types";

/** What to show in the SET column. Working sets are numbered 1, 2, 3...; warm-ups do not take a number. */
export function setLabel(sets: { type: SetType }[], index: number): string {
  const s = sets[index];
  if (!s) return "";
  if (s.type === "warmup") return "W";
  if (s.type === "drop") return "D";
  if (s.type === "failure") return "F";
  let n = 0;
  for (let i = 0; i <= index; i++) if (sets[i]?.type === "normal") n++;
  return String(n);
}

/** Decision (unverified against the original): warm-up sets do not count toward volume or set count. */
export function countsTowardTotals(s: Pick<WorkoutSet, "type" | "completed">): boolean {
  return s.completed && s.type !== "warmup";
}

export function workoutVolumeKg(w: Workout): number {
  let total = 0;
  for (const ex of w.exercises)
    for (const s of ex.sets)
      if (countsTowardTotals(s) && s.weightKg !== null && s.reps !== null) total += s.weightKg * s.reps;
  return total;
}

export function completedSetCount(w: Workout): number {
  let n = 0;
  for (const ex of w.exercises) for (const s of ex.sets) if (countsTowardTotals(s)) n++;
  return n;
}

export function totalSetCount(w: Workout): number {
  let n = 0;
  for (const ex of w.exercises) n += ex.sets.length;
  return n;
}

export function durationSeconds(w: Workout, nowMs: number = Date.now()): number {
  const start = new Date(w.startedAt).getTime();
  const end = w.endedAt ? new Date(w.endedAt).getTime() : nowMs;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}

/** For cards: "1h 6min", "56min", "40s". No seconds once it is a minute or more. */
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}

export function relativeDay(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const startOfDay = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(now)) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * The completed sets from the most recent EARLIER workout that included this exercise.
 * Same rule as previous_sets() in schema.sql: a workout counts only if it has a completed set of it.
 */
export function previousSets(
  exerciseId: string,
  before: string,
  workouts: Workout[],
): WorkoutSet[] {
  const beforeMs = new Date(before).getTime();
  let best: { at: number; sets: WorkoutSet[] } | null = null;
  for (const w of workouts) {
    const at = new Date(w.startedAt).getTime();
    if (at >= beforeMs) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const done = ex.sets.filter((s) => s.completed);
      if (done.length === 0) continue;
      if (!best || at > best.at) best = { at, sets: done };
    }
  }
  return best ? best.sets : [];
}

export function newWorkoutSet(partial?: Partial<WorkoutSet>): WorkoutSet {
  return { id: newId(), type: "normal", weightKg: null, reps: null, rpe: null, completed: false, ...partial };
}

export function newWorkoutExercise(exerciseId: string, prev: WorkoutSet[], restSeconds: number | null = null): WorkoutExercise {
  // Start with one empty set per previous set (or three if never done), prefilled from last time.
  const count = prev.length > 0 ? prev.length : 3;
  const sets: WorkoutSet[] = [];
  for (let i = 0; i < count; i++) {
    const p = prev[i];
    sets.push(newWorkoutSet({ type: p?.type ?? "normal", weightKg: p?.weightKg ?? null, reps: p?.reps ?? null }));
  }
  return { id: newId(), exerciseId, notes: "", restSeconds, supersetGroup: null, sets };
}

export function emptyWorkout(title = "Workout"): Workout {
  return {
    id: newId(), routineId: null, title, notes: "",
    startedAt: new Date().toISOString(), endedAt: null, exercises: [],
  };
}

/** A new live workout from a routine. Routine targets win; otherwise last time's numbers prefill. */
export function workoutFromRoutine(routine: Routine, history: Workout[]): Workout {
  const startedAt = new Date().toISOString();
  const exercises: WorkoutExercise[] = routine.exercises.map((re) => {
    const prev = previousSets(re.exerciseId, startedAt, history);
    const sets: WorkoutSet[] = re.sets.length > 0
      ? re.sets.map((rs, i) => newWorkoutSet({
          type: rs.type,
          weightKg: rs.weightKg ?? prev[i]?.weightKg ?? null,
          reps: rs.reps ?? prev[i]?.reps ?? null,
        }))
      : newWorkoutExercise(re.exerciseId, prev).sets;
    return {
      id: newId(), exerciseId: re.exerciseId, notes: re.notes, restSeconds: re.restSeconds,
      supersetGroup: re.supersetGroup, sets,
    };
  });
  return { id: newId(), routineId: routine.id, title: routine.name, notes: routine.notes, startedAt, endedAt: null, exercises };
}

/** Only completed sets are saved; exercises left with no completed sets are dropped. */
export function finalizeWorkout(w: Workout, endedAt: string = new Date().toISOString()): Workout | null {
  const exercises = w.exercises
    .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.completed) }))
    .filter((ex) => ex.sets.length > 0);
  if (exercises.length === 0) return null;
  return { ...w, exercises, endedAt };
}

/**
 * Records in this workout. Decision: a record is an exercise whose heaviest completed working set beats every
 * earlier workout's heaviest set of that exercise. The first time you ever do an exercise is not a record.
 * Computed from the data each time, so editing history cannot leave a stale count.
 */
export function countRecords(w: Workout, all: Workout[]): number {
  const startMs = new Date(w.startedAt).getTime();
  let records = 0;
  for (const ex of w.exercises) {
    const mine = Math.max(0, ...ex.sets.filter(countsTowardTotals).map((s) => s.weightKg ?? 0));
    if (mine <= 0) continue;
    let earlierBest = -1;
    for (const o of all) {
      if (o.id === w.id || new Date(o.startedAt).getTime() >= startMs) continue;
      for (const oe of o.exercises) {
        if (oe.exerciseId !== ex.exerciseId) continue;
        for (const s of oe.sets) if (countsTowardTotals(s) && (s.weightKg ?? 0) > earlierBest) earlierBest = s.weightKg ?? 0;
      }
    }
    if (earlierBest >= 0 && mine > earlierBest) records++;
  }
  return records;
}

export function routineFromWorkout(w: Workout, name: string): Routine {
  return {
    id: newId(), name, notes: w.notes, updatedAt: new Date().toISOString(),
    exercises: w.exercises.map((ex) => ({
      id: newId(), exerciseId: ex.exerciseId, restSeconds: ex.restSeconds, notes: ex.notes,
      supersetGroup: ex.supersetGroup,
      sets: ex.sets.map((s) => ({ type: s.type, weightKg: s.weightKg, reps: s.reps })),
    })),
  };
}
