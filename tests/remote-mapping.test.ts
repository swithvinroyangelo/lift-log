import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { isUuid, newId } from "../lib/ids";
import { SEED_EXERCISES, upgradeLegacyIds } from "../lib/seed-exercises";
import { assembleRoutines, assembleWorkouts, mapExercise, routinePayload, workoutPayload } from "../lib/store-remote";

describe("ids", () => {
  it("newId is always a real uuid", () => {
    for (let i = 0; i < 50; i++) expect(isUuid(newId())).toBe(true);
  });
  it("rejects non-uuids", () => {
    expect(isUuid("id-abc123")).toBe(false);
    expect(isUuid("builtin-pull-up")).toBe(false);
  });
});

describe("built-in exercises", () => {
  it("all have unique uuid ids", () => {
    const ids = SEED_EXERCISES.map((e) => e.id);
    expect(ids.every(isUuid)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("the database seed file lists exactly the same exercises", () => {
    const sql = fs.readFileSync("supabase/003_seed_exercises.sql", "utf8");
    for (const e of SEED_EXERCISES) {
      expect(sql, e.name).toContain(`'${e.id}', '${e.name}', '${e.muscle}', '${e.equipment}'`);
    }
    expect((sql.match(/^  \('/gm) ?? []).length).toBe(SEED_EXERCISES.length);
  });
  it("old local ids are upgraded everywhere inside saved data", () => {
    const pull = SEED_EXERCISES.find((e) => e.name === "Pull Up")!;
    const out = upgradeLegacyIds({ a: [{ exerciseId: "builtin-pull-up" }], keep: "builtin-not-a-real-one", n: 1 });
    expect(out.a[0]!.exerciseId).toBe(pull.id);
    expect(out.keep).toBe("builtin-not-a-real-one");
  });
});

describe("rows to app objects", () => {
  it("maps an exercise row", () => {
    expect(mapExercise({ id: "x", user_id: null, name: "A", muscle_group: "chest", equipment: "barbell", notes: null, archived_at: null }))
      .toEqual({ id: "x", name: "A", muscle: "chest", equipment: "barbell", custom: false });
    const c = mapExercise({ id: "y", user_id: "u", name: "B", muscle_group: "back", equipment: "other", notes: "n", archived_at: "2026-01-01T00:00:00Z" });
    expect(c).toMatchObject({ custom: true, notes: "n", archived: true });
  });

  it("assembles routines in position order and turns numeric strings into numbers", () => {
    const [r] = assembleRoutines(
      [{ id: "r1", name: "Push", notes: null, folder_id: "f1", updated_at: "t" }],
      [
        { id: "e2", routine_id: "r1", exercise_id: "x2", position: 1, rest_seconds: null, notes: null, superset_group: 1 },
        { id: "e1", routine_id: "r1", exercise_id: "x1", position: 0, rest_seconds: 120, notes: "hi", superset_group: null },
      ],
      [
        { routine_exercise_id: "e1", position: 1, set_type: "normal", target_weight_kg: "45.50" as unknown as number, target_reps: 12 },
        { routine_exercise_id: "e1", position: 0, set_type: "warmup", target_weight_kg: null, target_reps: 10 },
      ],
    );
    expect(r!.folderId).toBe("f1");
    expect(r!.exercises.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(r!.exercises[0]!.sets).toEqual([
      { type: "warmup", weightKg: null, reps: 10 },
      { type: "normal", weightKg: 45.5, reps: 12 },
    ]);
    expect(r!.exercises[1]!.sets).toEqual([]);
  });

  it("assembles workouts newest first with their sets in order", () => {
    const ws = assembleWorkouts(
      [
        { id: "w1", routine_id: null, title: "Old", notes: null, started_at: "2026-10-01T10:00:00+00:00", ended_at: "2026-10-01T11:00:00+00:00" },
        { id: "w2", routine_id: null, title: "New", notes: "n", started_at: "2026-10-20T10:00:00+00:00", ended_at: "2026-10-20T11:00:00+00:00" },
      ],
      [{ id: "we", workout_id: "w2", exercise_id: "x", position: 0, notes: null, superset_group: null }],
      [
        { id: "s2", workout_exercise_id: "we", position: 1, set_type: "failure", weight_kg: 50, reps: 5, rpe: 9.5, completed: true },
        { id: "s1", workout_exercise_id: "we", position: 0, set_type: "normal", weight_kg: 40, reps: 10, rpe: null, completed: true },
      ],
    );
    expect(ws.map((w) => w.title)).toEqual(["New", "Old"]);
    expect(ws[0]!.exercises[0]!.sets.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(ws[0]!.exercises[0]!.sets[1]).toMatchObject({ type: "failure", rpe: 9.5 });
    expect(ws[0]!.endedAt).toBe("2026-10-20T11:00:00+00:00");
  });
});

describe("app objects to database payloads", () => {
  it("routine payload keeps folder and trims the name", () => {
    const p = routinePayload({ id: "r", name: "  Push ", notes: "", folderId: undefined, exercises: [], updatedAt: "t" });
    expect(p).toMatchObject({ id: "r", name: "Push", folderId: null });
  });
  it("workout payload always has an end time", () => {
    const p = workoutPayload({ id: "w", routineId: null, title: "t", notes: "", startedAt: "2026-10-20T10:00:00Z", endedAt: null, exercises: [] });
    expect(typeof p.endedAt).toBe("string");
  });
});
