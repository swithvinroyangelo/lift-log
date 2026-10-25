// Shapes mirror replica/schema.sql. Weights are always kg in storage; units.ts converts for display.

export type SetType = "normal" | "warmup" | "drop" | "failure";

export const MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs",
  "quads", "hamstrings", "glutes", "calves", "full_body", "cardio", "other",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export interface Exercise {
  id: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  custom: boolean;
  notes?: string;
  archived?: boolean;
}

export interface RoutineSet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  restSeconds: number | null;
  notes: string;
  supersetGroup: number | null;
  sets: RoutineSet[];
}

export interface RoutineFolder {
  id: string;
  name: string;
  position: number;
}

export interface Routine {
  id: string;
  name: string;
  notes: string;
  folderId?: string | null;
  exercises: RoutineExercise[];
  updatedAt: string;
}

export interface WorkoutSet {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  notes: string;
  restSeconds: number | null;
  supersetGroup: number | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  routineId: string | null;
  title: string;
  notes: string;
  startedAt: string;
  endedAt: string | null; // null while it is a draft
  exercises: WorkoutExercise[];
}

export interface RestTimer {
  endsAt: number; // epoch ms. Remaining time is computed from this, never by counting ticks.
  totalSeconds: number;
}

export interface Draft {
  workout: Workout;
  rest: RestTimer | null;
}

export interface Settings {
  units: "kg" | "lb";
  defaultRestSeconds: number;
  displayName: string;
}

export const DEFAULT_SETTINGS: Settings = { units: "kg", defaultRestSeconds: 90, displayName: "" };
