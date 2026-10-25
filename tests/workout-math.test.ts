import { describe, expect, it } from "vitest";
import {
  completedSetCount, countRecords, finalizeWorkout, formatClock, formatMmSs, previousSets,
  routineFromWorkout, setLabel, workoutFromRoutine, workoutVolumeKg,
} from "@/lib/workout-math";
import { formatVolume, fromDisplay, toDisplay } from "@/lib/units";
import type { Routine, Workout, WorkoutSet } from "@/lib/types";

const set = (p: Partial<WorkoutSet>): WorkoutSet => ({
  id: Math.random().toString(36), type: "normal", weightKg: null, reps: null, rpe: null, completed: false, ...p,
});

function workout(id: string, startedAt: string, exerciseId: string, sets: WorkoutSet[]): Workout {
  return {
    id, routineId: null, title: id, notes: "", startedAt, endedAt: startedAt,
    exercises: [{ id: id + "-e", exerciseId, notes: "", restSeconds: null, supersetGroup: null, sets }],
  };
}

describe("set labels", () => {
  it("numbers working sets and skips warm-ups (matches the reference: 1, 2, 3, W, 4)", () => {
    const sets = [{ type: "normal" }, { type: "normal" }, { type: "normal" }, { type: "warmup" }, { type: "normal" }] as const;
    expect([0, 1, 2, 3, 4].map((i) => setLabel([...sets], i))).toEqual(["1", "2", "3", "W", "4"]);
  });
  it("labels drop and failure sets with letters", () => {
    expect(setLabel([{ type: "drop" }, { type: "failure" }], 0)).toBe("D");
    expect(setLabel([{ type: "drop" }, { type: "failure" }], 1)).toBe("F");
  });
});

describe("totals", () => {
  it("3 completed sets of 45 kg x 12 is 1,620 kg and 3 sets (the reference screenshot)", () => {
    const w = workout("a", "2026-10-01T10:00:00Z", "x", [
      set({ weightKg: 45, reps: 12, completed: true }),
      set({ weightKg: 45, reps: 12, completed: true }),
      set({ weightKg: 45, reps: 12, completed: true }),
      set({ type: "warmup", weightKg: 20, reps: 12, completed: false }),
    ]);
    expect(workoutVolumeKg(w)).toBe(1620);
    expect(completedSetCount(w)).toBe(3);
    expect(formatVolume(1620, "kg")).toBe("1,620 kg");
  });
  it("does not count a completed warm-up (decision)", () => {
    const w = workout("a", "2026-10-01T10:00:00Z", "x", [set({ type: "warmup", weightKg: 20, reps: 12, completed: true })]);
    expect(workoutVolumeKg(w)).toBe(0);
  });
  it("does not count uncompleted sets", () => {
    const w = workout("a", "2026-10-01T10:00:00Z", "x", [set({ weightKg: 100, reps: 5, completed: false })]);
    expect(workoutVolumeKg(w)).toBe(0);
  });
});

describe("previous sets (same rule as previous_sets() in schema.sql)", () => {
  const old = workout("old", "2026-10-01T10:00:00Z", "bench", [
    set({ weightKg: 60, reps: 8, completed: true }), set({ weightKg: 60, reps: 7, completed: true }), set({ weightKg: 60, reps: 5, completed: false }),
  ]);
  const newer = workout("newer", "2026-10-03T10:00:00Z", "bench", [set({ weightKg: 62.5, reps: 8, completed: true })]);
  it("picks the latest earlier workout", () => {
    expect(previousSets("bench", "2026-10-04T00:00:00Z", [old, newer]).map((s) => `${s.weightKg}x${s.reps}`)).toEqual(["62.5x8"]);
  });
  it("skips sets that were never completed", () => {
    expect(previousSets("bench", "2026-10-02T00:00:00Z", [old, newer]).map((s) => `${s.weightKg}x${s.reps}`)).toEqual(["60x8", "60x7"]);
  });
  it("ignores workouts that are not earlier", () => {
    expect(previousSets("bench", "2026-10-01T10:00:00Z", [old, newer])).toEqual([]);
  });
  it("ignores other exercises", () => {
    expect(previousSets("squat", "2026-12-01T00:00:00Z", [old, newer])).toEqual([]);
  });
});

describe("finishing a workout", () => {
  it("keeps only completed sets and drops empty exercises", () => {
    const w = workout("w", "2026-10-05T10:00:00Z", "bench", [
      set({ weightKg: 50, reps: 10, completed: true }), set({ weightKg: 50, reps: 10, completed: false }),
    ]);
    w.endedAt = null;
    w.exercises.push({ id: "e2", exerciseId: "squat", notes: "", restSeconds: null, supersetGroup: null, sets: [set({ weightKg: 80, reps: 5 })] });
    const done = finalizeWorkout(w, "2026-10-05T11:00:00Z");
    expect(done?.exercises).toHaveLength(1);
    expect(done?.exercises[0]?.sets).toHaveLength(1);
    expect(done?.endedAt).toBe("2026-10-05T11:00:00Z");
  });
  it("returns null when nothing was completed (nothing to save)", () => {
    const w = workout("w", "2026-10-05T10:00:00Z", "bench", [set({ weightKg: 50, reps: 10 })]);
    expect(finalizeWorkout(w)).toBeNull();
  });
});

describe("records", () => {
  const first = workout("first", "2026-10-01T10:00:00Z", "bench", [set({ weightKg: 60, reps: 8, completed: true })]);
  it("the first time you do an exercise is not a record", () => {
    expect(countRecords(first, [first])).toBe(0);
  });
  it("beating every earlier heaviest set is a record", () => {
    const second = workout("second", "2026-10-08T10:00:00Z", "bench", [set({ weightKg: 62.5, reps: 5, completed: true })]);
    expect(countRecords(second, [first, second])).toBe(1);
  });
  it("matching the earlier best is not a record", () => {
    const second = workout("second", "2026-10-08T10:00:00Z", "bench", [set({ weightKg: 60, reps: 10, completed: true })]);
    expect(countRecords(second, [first, second])).toBe(0);
  });
  it("editing history cannot leave a stale count (it is recomputed)", () => {
    const second = workout("second", "2026-10-08T10:00:00Z", "bench", [set({ weightKg: 62.5, reps: 5, completed: true })]);
    first.exercises[0]!.sets[0]!.weightKg = 70;
    expect(countRecords(second, [first, second])).toBe(0);
    first.exercises[0]!.sets[0]!.weightKg = 60;
  });
});

describe("routines and workouts", () => {
  const routine: Routine = {
    id: "r1", name: "Push", notes: "Chest first", updatedAt: "2026-10-01T00:00:00Z",
    exercises: [{ id: "re1", exerciseId: "bench", restSeconds: 120, notes: "", supersetGroup: null,
      sets: [{ type: "normal", weightKg: null, reps: null }, { type: "warmup", weightKg: 20, reps: 12 }] }],
  };
  it("starting a routine prefills from last time and keeps the rest time and note", () => {
    const hist = [workout("old", "2026-10-01T10:00:00Z", "bench", [set({ weightKg: 45, reps: 12, completed: true })])];
    const w = workoutFromRoutine(routine, hist);
    expect(w.title).toBe("Push");
    expect(w.notes).toBe("Chest first");
    expect(w.exercises[0]?.restSeconds).toBe(120);
    expect(w.exercises[0]?.sets[0]).toMatchObject({ weightKg: 45, reps: 12, completed: false });
    expect(w.exercises[0]?.sets[1]).toMatchObject({ type: "warmup", weightKg: 20, reps: 12 });
  });
  it("editing a routine later never changes a workout already started from it", () => {
    const w = workoutFromRoutine(routine, []);
    routine.exercises[0]!.sets[1]!.weightKg = 99;
    expect(w.exercises[0]?.sets[1]?.weightKg).toBe(20);
    routine.exercises[0]!.sets[1]!.weightKg = 20;
  });
  it("save as routine keeps exercises and set types", () => {
    const w = workout("w", "2026-10-05T10:00:00Z", "bench", [set({ type: "warmup", weightKg: 20, reps: 12, completed: true })]);
    const r = routineFromWorkout(w, "From workout");
    expect(r.exercises[0]?.sets[0]).toEqual({ type: "warmup", weightKg: 20, reps: 12 });
  });
});

describe("units and clocks", () => {
  it("135 lb survives a round trip through kg (shows 135, not 134.99)", () => {
    for (const lb of [45, 95, 135, 185, 225, 315]) expect(toDisplay(fromDisplay(lb, "lb"), "lb")).toBe(lb);
  });
  it("formats clocks", () => {
    expect(formatClock(5)).toBe("5s");
    expect(formatClock(66 * 60)).toBe("1h 6min");
    expect(formatClock(56 * 60)).toBe("56min 0s");
    expect(formatMmSs(114)).toBe("01:54");
    expect(formatMmSs(0)).toBe("00:00");
  });
});
