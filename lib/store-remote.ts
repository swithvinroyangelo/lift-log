// The Supabase data layer: same functions and shapes as store-local.ts, so no screen changes.
// Reads are plain selects (row level security limits them to your own rows). Saving a routine or a workout
// goes through one database function (save_routine / save_workout) so it is all-or-nothing.
//
// Not synced on purpose: the unfinished workout (draft). It stays on this phone so a workout works with no signal.
// Finishing needs a connection; if it fails the draft is kept and Finish can be tapped again (same id, no duplicates).

import { newId, isUuid } from "./ids";
import { upgradeLegacyIds } from "./seed-exercises";
import { currentUserId, getClient } from "./supabase";
import { DEFAULT_SETTINGS } from "./types";
import type {
  Draft, Equipment, Exercise, Muscle, Routine, RoutineExercise, RoutineFolder, RoutineSet, SetType, Settings,
  Workout, WorkoutExercise, WorkoutSet,
} from "./types";

// ---------------------------------------------------------------- rows (snake_case, as the database returns them)
interface ExerciseRow { id: string; user_id: string | null; name: string; muscle_group: Muscle; equipment: Equipment; notes: string | null; archived_at: string | null }
interface FolderRow { id: string; name: string; position: number }
interface RoutineRow { id: string; name: string; notes: string | null; folder_id: string | null; updated_at: string }
interface RoutineExRow { id: string; routine_id: string; exercise_id: string; position: number; rest_seconds: number | null; notes: string | null; superset_group: number | null }
interface RoutineSetRow { routine_exercise_id: string; position: number; set_type: SetType; target_weight_kg: number | null; target_reps: number | null }
interface WorkoutRow { id: string; routine_id: string | null; title: string; notes: string | null; started_at: string; ended_at: string }
interface WorkoutExRow { id: string; workout_id: string; exercise_id: string; position: number; notes: string | null; superset_group: number | null }
interface WorkoutSetRow { id: string; workout_exercise_id: string; position: number; set_type: SetType; weight_kg: number | null; reps: number | null; rpe: number | null; completed: boolean }

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = key(r); const list = m.get(k); if (list) list.push(r); else m.set(k, [r]); }
  return m;
}
const num = (v: number | string | null): number | null => (v === null || v === undefined ? null : Number(v));

// ---------------------------------------------------------------- pure mapping (unit-tested)
export function mapExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id, name: r.name, muscle: r.muscle_group, equipment: r.equipment, custom: r.user_id !== null,
    ...(r.notes ? { notes: r.notes } : {}), ...(r.archived_at ? { archived: true } : {}),
  };
}

export function assembleRoutines(routines: RoutineRow[], exs: RoutineExRow[], sets: RoutineSetRow[]): Routine[] {
  const exByRoutine = groupBy(exs, (e) => e.routine_id);
  const setByEx = groupBy(sets, (s) => s.routine_exercise_id);
  return routines.map((r): Routine => ({
    id: r.id, name: r.name, notes: r.notes ?? "", folderId: r.folder_id, updatedAt: r.updated_at,
    exercises: (exByRoutine.get(r.id) ?? []).sort(byPosition).map((e): RoutineExercise => ({
      id: e.id, exerciseId: e.exercise_id, restSeconds: e.rest_seconds, notes: e.notes ?? "", supersetGroup: e.superset_group,
      sets: (setByEx.get(e.id) ?? []).sort(byPosition).map((s): RoutineSet => ({ type: s.set_type, weightKg: num(s.target_weight_kg), reps: s.target_reps })),
    })),
  }));
}

export function assembleWorkouts(workouts: WorkoutRow[], exs: WorkoutExRow[], sets: WorkoutSetRow[]): Workout[] {
  const exByWorkout = groupBy(exs, (e) => e.workout_id);
  const setByEx = groupBy(sets, (s) => s.workout_exercise_id);
  return workouts.map((w): Workout => ({
    id: w.id, routineId: w.routine_id, title: w.title, notes: w.notes ?? "", startedAt: w.started_at, endedAt: w.ended_at,
    exercises: (exByWorkout.get(w.id) ?? []).sort(byPosition).map((e): WorkoutExercise => ({
      id: e.id, exerciseId: e.exercise_id, notes: e.notes ?? "", restSeconds: null, supersetGroup: e.superset_group,
      sets: (setByEx.get(e.id) ?? []).sort(byPosition).map((s): WorkoutSet => ({
        id: s.id, type: s.set_type, weightKg: num(s.weight_kg), reps: s.reps, rpe: num(s.rpe), completed: s.completed,
      })),
    })),
  })).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function routinePayload(r: Routine) {
  return { id: r.id, name: r.name.trim(), notes: r.notes ?? "", folderId: r.folderId ?? null, exercises: r.exercises };
}
export function workoutPayload(w: Workout) {
  return { ...w, endedAt: w.endedAt ?? new Date().toISOString() };
}

// ---------------------------------------------------------------- plumbing
function fail(what: string, error: { message: string }): Error {
  return new Error(`Could not ${what}: ${error.message}`);
}
function uid(): string {
  const id = currentUserId();
  if (!id) throw new Error("You are signed out. Sign in again.");
  return id;
}

type Query = ReturnType<ReturnType<ReturnType<typeof getClient>["from"]>["select"]>;
/** The API returns at most 1000 rows per request, so read in pages. */
async function fetchAll<T>(table: string, narrow?: (q: Query) => Query): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = getClient().from(table).select("*");
    if (narrow) q = narrow(q);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw fail(`load ${table.replace(/_/g, " ")}`, error);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
const inChunks = <T,>(ids: T[], size = 100): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
};

// ---------------------------------------------------------------- caches (cleared on every write that affects them)
let exercisesCache: Promise<Exercise[]> | null = null;
let workoutsCache: Promise<Workout[]> | null = null;
let settingsCache: Promise<Settings> | null = null;
export function clearCaches(): void { exercisesCache = null; workoutsCache = null; settingsCache = null; }

function allExercises(): Promise<Exercise[]> {
  if (!exercisesCache) {
    exercisesCache = fetchAll<ExerciseRow>("exercises").then((rows) => rows.map(mapExercise)).catch((e) => { exercisesCache = null; throw e; });
  }
  return exercisesCache;
}

// ---------------------------------------------------------------- exercises
export async function listExercises(): Promise<Exercise[]> {
  return (await allExercises()).filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name));
}
export async function getExerciseMap(): Promise<Record<string, Exercise>> {
  const map: Record<string, Exercise> = {};
  for (const e of await allExercises()) map[e.id] = e; // includes archived: history still needs the name
  return map;
}
export async function createExercise(e: Exercise): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = e.name.trim();
  if (!name) return { ok: false, error: "Give the exercise a name." };
  const existing = await allExercises();
  if (existing.some((x) => !x.archived && x.name.trim().toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "An exercise with that name already exists." };
  }
  const { error } = await getClient().from("exercises").insert({
    id: isUuid(e.id) ? e.id : newId(), user_id: uid(), name, muscle_group: e.muscle, equipment: e.equipment, notes: e.notes ?? null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "An exercise with that name already exists." };
    throw fail("save the exercise", error);
  }
  exercisesCache = null;
  return { ok: true };
}

// ---------------------------------------------------------------- routines
async function loadRoutines(narrow?: (q: Query) => Query): Promise<Routine[]> {
  const rows = await fetchAll<RoutineRow>("routines", narrow);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const exs = narrow
    ? (await Promise.all(inChunks(ids).map((c) => fetchAll<RoutineExRow>("routine_exercises", (q) => q.in("routine_id", c))))).flat()
    : await fetchAll<RoutineExRow>("routine_exercises");
  const exIds = exs.map((e) => e.id);
  const sets = narrow
    ? (await Promise.all(inChunks(exIds).map((c) => fetchAll<RoutineSetRow>("routine_sets", (q) => q.in("routine_exercise_id", c))))).flat()
    : await fetchAll<RoutineSetRow>("routine_sets");
  return assembleRoutines(rows, exs, sets);
}
export async function listRoutines(): Promise<Routine[]> {
  return (await loadRoutines()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getRoutine(id: string): Promise<Routine | null> {
  if (!isUuid(id)) return null;
  return (await loadRoutines((q) => q.eq("id", id)))[0] ?? null;
}
/** No cap on how many routines exist. */
export async function saveRoutine(r: Routine): Promise<void> {
  const { error } = await getClient().rpc("save_routine", { p: routinePayload(r) });
  if (error) throw fail("save the routine", error);
}
export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await getClient().from("routines").delete().eq("id", id);
  if (error) throw fail("delete the routine", error);
}

// ---------------------------------------------------------------- routine folders
export async function listFolders(): Promise<RoutineFolder[]> {
  const rows = await fetchAll<FolderRow>("routine_folders");
  return rows.map((f) => ({ id: f.id, name: f.name, position: f.position }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
export async function saveFolder(f: RoutineFolder): Promise<void> {
  const { error } = await getClient().from("routine_folders").upsert({ id: f.id, user_id: uid(), name: f.name.trim(), position: f.position });
  if (error) throw fail("save the folder", error);
}
/** Deleting a folder keeps its routines; the database sets their folder to none. */
export async function deleteFolder(id: string): Promise<void> {
  const { error } = await getClient().from("routine_folders").delete().eq("id", id);
  if (error) throw fail("delete the folder", error);
}

// ---------------------------------------------------------------- workouts
async function loadWorkouts(narrow?: (q: Query) => Query): Promise<Workout[]> {
  const rows = await fetchAll<WorkoutRow>("workouts", narrow);
  if (rows.length === 0) return [];
  const exs = narrow
    ? (await Promise.all(inChunks(rows.map((w) => w.id)).map((c) => fetchAll<WorkoutExRow>("workout_exercises", (q) => q.in("workout_id", c))))).flat()
    : await fetchAll<WorkoutExRow>("workout_exercises");
  const sets = narrow
    ? (await Promise.all(inChunks(exs.map((e) => e.id)).map((c) => fetchAll<WorkoutSetRow>("workout_sets", (q) => q.in("workout_exercise_id", c))))).flat()
    : await fetchAll<WorkoutSetRow>("workout_sets");
  return assembleWorkouts(rows, exs, sets);
}
export async function listWorkouts(): Promise<Workout[]> {
  if (!workoutsCache) workoutsCache = loadWorkouts().catch((e) => { workoutsCache = null; throw e; });
  return workoutsCache;
}
export async function getWorkout(id: string): Promise<Workout | null> {
  if (!isUuid(id)) return null;
  return (await loadWorkouts((q) => q.eq("id", id)))[0] ?? null;
}
/** Idempotent: the same id twice replaces, never duplicates, so a retry after a dropped connection is safe. */
export async function saveWorkout(w: Workout): Promise<void> {
  workoutsCache = null;
  const { error } = await getClient().rpc("save_workout", { p: workoutPayload(w) });
  if (error) throw fail("save the workout", error);
}
export async function deleteWorkout(id: string): Promise<void> {
  workoutsCache = null;
  const { error } = await getClient().from("workouts").delete().eq("id", id);
  if (error) throw fail("delete the workout", error);
}

// ---------------------------------------------------------------- the unfinished workout (this device only)
const draftKey = () => `lift-log:v2:draft:${currentUserId() ?? "anon"}`;
export async function loadDraft(): Promise<Draft | null> {
  try {
    const raw = window.localStorage.getItem(draftKey());
    return raw ? upgradeLegacyIds(JSON.parse(raw) as Draft) : null;
  } catch { return null; }
}
export function saveDraftNow(d: Draft): void {
  try { window.localStorage.setItem(draftKey(), JSON.stringify(d)); } catch { /* storage blocked: the workout still works, it just will not survive a reload */ }
}
export async function clearDraft(): Promise<void> {
  try { window.localStorage.removeItem(draftKey()); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- settings (profiles row)
interface ProfileRow { units: "kg" | "lb"; default_rest_seconds: number; display_name: string | null }
export async function getSettings(): Promise<Settings> {
  if (!settingsCache) {
    settingsCache = (async () => {
      const { data, error } = await getClient().from("profiles").select("units, default_rest_seconds, display_name").eq("id", uid()).maybeSingle();
      if (error) throw fail("load your settings", error);
      const p = data as ProfileRow | null;
      return p ? { units: p.units, defaultRestSeconds: p.default_rest_seconds, displayName: p.display_name ?? "" } : { ...DEFAULT_SETTINGS };
    })().catch((e) => { settingsCache = null; throw e; });
  }
  return settingsCache;
}
export async function saveSettings(s: Settings): Promise<void> {
  settingsCache = null;
  const { error } = await getClient().from("profiles").upsert({
    id: uid(), units: s.units, default_rest_seconds: s.defaultRestSeconds, display_name: s.displayName || null,
  });
  if (error) throw fail("save your settings", error);
}

// ---------------------------------------------------------------- backup
export async function exportBackup(): Promise<string> {
  const [exercises, routines, routineFolders, workouts, settings] = await Promise.all([
    allExercises(), listRoutines(), listFolders(), listWorkouts(), getSettings(),
  ]);
  const data = { customExercises: exercises.filter((e) => e.custom), routines, routineFolders, workouts, settings };
  return JSON.stringify({ app: "lift-log", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}

/**
 * Adds a backup's contents to your account (it never deletes anything, and importing the same file twice
 * changes nothing). Works with backups made by the browser-only version: ids that are not real UUIDs get new ones.
 */
export async function importBackup(text: string): Promise<{ ok: true; workouts: number; routines: number } | { ok: false; error: string }> {
  let parsed: { app?: string; data?: Record<string, unknown> };
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: "Could not read that file." }; }
  if (parsed.app !== "lift-log" || !parsed.data) return { ok: false, error: "That file is not a Lift Log backup." };
  const d = upgradeLegacyIds(parsed.data) as {
    customExercises?: Exercise[]; routines?: Routine[]; routineFolders?: RoutineFolder[]; workouts?: Workout[]; settings?: Partial<Settings>;
  };

  const fixed = new Map<string, string>();
  const fix = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (isUuid(id)) return id;
    let v = fixed.get(id);
    if (!v) { v = newId(); fixed.set(id, v); }
    return v;
  };

  // custom exercises first (routines and workouts point at them); a name that already exists maps onto the existing one
  const existing = await allExercises();
  const byName = new Map(existing.filter((e) => !e.archived).map((e) => [e.name.trim().toLowerCase(), e.id]));
  const exId = new Map<string, string>();
  for (const e of d.customExercises ?? []) {
    const clash = byName.get(e.name.trim().toLowerCase());
    if (clash) { exId.set(e.id, clash); continue; }
    const id = fix(e.id) as string;
    const r = await createExercise({ ...e, id });
    if (!r.ok) return { ok: false, error: r.error };
    exId.set(e.id, id);
    byName.set(e.name.trim().toLowerCase(), id);
  }
  const mapEx = (id: string) => exId.get(id) ?? (fix(id) as string);

  for (const f of d.routineFolders ?? []) await saveFolder({ ...f, id: fix(f.id) as string });
  for (const r of d.routines ?? []) {
    await saveRoutine({ ...r, id: fix(r.id) as string, folderId: fix(r.folderId),
      exercises: r.exercises.map((e) => ({ ...e, id: fix(e.id) as string, exerciseId: mapEx(e.exerciseId) })) });
  }
  const done = (d.workouts ?? []).filter((w) => w.endedAt);
  for (const w of done) {
    await saveWorkout({ ...w, id: fix(w.id) as string, routineId: fix(w.routineId),
      exercises: w.exercises.map((e) => ({ ...e, id: fix(e.id) as string, exerciseId: mapEx(e.exerciseId),
        sets: e.sets.map((s) => ({ ...s, id: fix(s.id) as string })) })) });
  }
  if (d.settings) await saveSettings({ ...(await getSettings()), ...d.settings });
  clearCaches();
  return { ok: true, workouts: done.length, routines: (d.routines ?? []).length };
}
