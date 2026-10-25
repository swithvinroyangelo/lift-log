// The browser-only data layer (used when no Supabase keys are set, and by the browser tests). Every function is async and takes/returns plain objects so the real database
// (Supabase) can replace this file without any screen changing. This version keeps data in the browser.
//
// Honest limit: browser storage can be cleared by the browser (iOS Safari may clear sites that were not
// opened for about a week unless the app is installed to the home screen). Use Profile > Export backup.

import { SEED_EXERCISES, upgradeLegacyIds } from "./seed-exercises";
import { DEFAULT_SETTINGS } from "./types";
import type { Draft, Exercise, Routine, RoutineFolder, Settings, Workout } from "./types";

const KEY = "lift-log:v1";
const DRAFT_KEY = "lift-log:v1:draft";

interface Db {
  customExercises: Exercise[];
  routines: Routine[];
  routineFolders: RoutineFolder[];
  workouts: Workout[];
  settings: Settings;
}

const memory: Record<string, string> = {}; // fallback when storage is blocked (private windows)

function read(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ?? memory[key] ?? null;
  } catch {
    return memory[key] ?? null;
  }
}
function write(key: string, value: string): void {
  memory[key] = value;
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked: memory copy only */ }
}
function remove(key: string): void {
  delete memory[key];
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

function emptyDb(): Db {
  return { customExercises: [], routines: [], routineFolders: [], workouts: [], settings: { ...DEFAULT_SETTINGS } };
}

function loadDb(): Db {
  const raw = read(KEY);
  if (!raw) return emptyDb();
  try {
    const parsed = upgradeLegacyIds(JSON.parse(raw) as Partial<Db>);
    return {
      customExercises: parsed.customExercises ?? [],
      routines: parsed.routines ?? [],
      routineFolders: parsed.routineFolders ?? [],
      workouts: parsed.workouts ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return emptyDb();
  }
}
function saveDb(db: Db): void {
  write(KEY, JSON.stringify(db));
}

// ---------------------------------------------------------------- exercises
export async function listExercises(): Promise<Exercise[]> {
  const db = loadDb();
  return [...SEED_EXERCISES, ...db.customExercises.filter((e) => !e.archived)]
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExerciseMap(): Promise<Record<string, Exercise>> {
  const db = loadDb();
  const map: Record<string, Exercise> = {};
  for (const e of [...SEED_EXERCISES, ...db.customExercises]) map[e.id] = e; // includes archived: history still needs the name
  return map;
}

export async function createExercise(e: Exercise): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = loadDb();
  const name = e.name.trim();
  if (!name) return { ok: false, error: "Give the exercise a name." };
  const clash = [...SEED_EXERCISES, ...db.customExercises.filter((x) => !x.archived)]
    .some((x) => x.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) return { ok: false, error: "An exercise with that name already exists." };
  db.customExercises.push({ ...e, name, custom: true });
  saveDb(db);
  return { ok: true };
}

// ---------------------------------------------------------------- routines
export async function listRoutines(): Promise<Routine[]> {
  return loadDb().routines.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getRoutine(id: string): Promise<Routine | null> {
  return loadDb().routines.find((r) => r.id === id) ?? null;
}
/** No cap on how many routines exist. That is the point of this app. */
export async function saveRoutine(r: Routine): Promise<void> {
  const db = loadDb();
  const next = { ...r, updatedAt: new Date().toISOString() };
  const i = db.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) db.routines[i] = next; else db.routines.push(next);
  saveDb(db);
}
export async function deleteRoutine(id: string): Promise<void> {
  const db = loadDb();
  db.routines = db.routines.filter((r) => r.id !== id);
  saveDb(db); // past workouts keep their data; they only forget which routine they came from
}

// ---------------------------------------------------------------- routine folders
export async function listFolders(): Promise<RoutineFolder[]> {
  return loadDb().routineFolders.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
export async function saveFolder(f: RoutineFolder): Promise<void> {
  const db = loadDb();
  const i = db.routineFolders.findIndex((x) => x.id === f.id);
  if (i >= 0) db.routineFolders[i] = f; else db.routineFolders.push(f);
  saveDb(db);
}
/** Deleting a folder keeps its routines; they become loose (same rule as the schema). */
export async function deleteFolder(id: string): Promise<void> {
  const db = loadDb();
  db.routineFolders = db.routineFolders.filter((f) => f.id !== id);
  db.routines = db.routines.map((r) => (r.folderId === id ? { ...r, folderId: null } : r));
  saveDb(db);
}

// ---------------------------------------------------------------- workouts
export async function listWorkouts(): Promise<Workout[]> {
  return loadDb().workouts.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
export async function getWorkout(id: string): Promise<Workout | null> {
  return loadDb().workouts.find((w) => w.id === id) ?? null;
}
/** Idempotent: saving the same id twice replaces, never duplicates (a retry after a bad connection is safe). */
export async function saveWorkout(w: Workout): Promise<void> {
  const db = loadDb();
  const i = db.workouts.findIndex((x) => x.id === w.id);
  if (i >= 0) db.workouts[i] = w; else db.workouts.push(w);
  saveDb(db);
}
export async function deleteWorkout(id: string): Promise<void> {
  const db = loadDb();
  db.workouts = db.workouts.filter((w) => w.id !== id);
  saveDb(db);
}

// ---------------------------------------------------------------- the unfinished workout
export async function loadDraft(): Promise<Draft | null> {
  const raw = read(DRAFT_KEY);
  if (!raw) return null;
  try { return upgradeLegacyIds(JSON.parse(raw) as Draft); } catch { return null; }
}
/** Called after every change, so a closed tab or dead battery loses at most the last keystroke. */
export function saveDraftNow(d: Draft): void {
  write(DRAFT_KEY, JSON.stringify(d));
}
export async function clearDraft(): Promise<void> {
  remove(DRAFT_KEY);
}

// ---------------------------------------------------------------- settings
export async function getSettings(): Promise<Settings> {
  return loadDb().settings;
}
export async function saveSettings(s: Settings): Promise<void> {
  const db = loadDb();
  db.settings = s;
  saveDb(db);
}

// ---------------------------------------------------------------- backup
export async function exportBackup(): Promise<string> {
  return JSON.stringify({ app: "lift-log", version: 1, exportedAt: new Date().toISOString(), data: loadDb() }, null, 2);
}
export async function importBackup(text: string): Promise<{ ok: true; workouts: number; routines: number } | { ok: false; error: string }> {
  try {
    const parsed = JSON.parse(text) as { app?: string; data?: Partial<Db> };
    if (parsed.app !== "lift-log" || !parsed.data) return { ok: false, error: "That file is not a Lift Log backup." };
    const d = upgradeLegacyIds(parsed.data);
    const db: Db = {
      customExercises: Array.isArray(d.customExercises) ? d.customExercises : [],
      routines: Array.isArray(d.routines) ? d.routines : [],
      routineFolders: Array.isArray(d.routineFolders) ? d.routineFolders : [],
      workouts: Array.isArray(d.workouts) ? d.workouts : [],
      settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    };
    saveDb(db);
    return { ok: true, workouts: db.workouts.length, routines: db.routines.length };
  } catch {
    return { ok: false, error: "Could not read that file." };
  }
}
