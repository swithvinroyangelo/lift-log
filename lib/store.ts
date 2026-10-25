// The screens import from here only. With Supabase keys set, data lives in your account; without them
// (local development, the browser tests) it lives in this browser. Both files export the same functions;
// the `Store` type below makes the compiler refuse to build if they ever drift apart.
import { REMOTE } from "./supabase";
import * as local from "./store-local";
import * as remote from "./store-remote";

type Store = typeof local;
const remoteChecked: Store = remote; // compile error here if the two files ever disagree
const impl: Store = REMOTE ? remoteChecked : local;

export const listExercises = impl.listExercises;
export const getExerciseMap = impl.getExerciseMap;
export const createExercise = impl.createExercise;
export const listRoutines = impl.listRoutines;
export const getRoutine = impl.getRoutine;
export const saveRoutine = impl.saveRoutine;
export const deleteRoutine = impl.deleteRoutine;
export const listFolders = impl.listFolders;
export const saveFolder = impl.saveFolder;
export const deleteFolder = impl.deleteFolder;
export const listWorkouts = impl.listWorkouts;
export const getWorkout = impl.getWorkout;
export const saveWorkout = impl.saveWorkout;
export const deleteWorkout = impl.deleteWorkout;
export const loadDraft = impl.loadDraft;
export const saveDraftNow = impl.saveDraftNow;
export const clearDraft = impl.clearDraft;
export const getSettings = impl.getSettings;
export const saveSettings = impl.saveSettings;
export const exportBackup = impl.exportBackup;
export const importBackup = impl.importBackup;
