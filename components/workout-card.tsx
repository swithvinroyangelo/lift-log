"use client";

import { Medal } from "lucide-react";
import Link from "next/link";
import { ExerciseThumb } from "./ui";
import { formatVolume } from "@/lib/units";
import {
  completedSetCount, countRecords, durationSeconds, formatDurationShort, relativeDay, workoutVolumeKg,
} from "@/lib/workout-math";
import type { Exercise, Workout } from "@/lib/types";

export function WorkoutCard({
  workout, all, exercises, units,
}: { workout: Workout; all: Workout[]; exercises: Record<string, Exercise>; units: "kg" | "lb" }) {
  const shown = workout.exercises.slice(0, 3);
  const more = workout.exercises.length - shown.length;
  const records = countRecords(workout, all);
  return (
    <article className="border-b-8 border-surface px-margin py-4" aria-label={`${workout.title}, ${relativeDay(workout.startedAt)}`}>
      <Link href={`/history/${workout.id}`} className="block">
        <p className="text-xs text-muted">{relativeDay(workout.startedAt)}</p>
        <h2 className="mt-1 text-lg">{workout.title}</h2>
        <dl className="mt-3 flex gap-8">
          <div><dt className="text-xs text-muted">Time</dt><dd className="tnum text-sm font-semibold">{formatDurationShort(durationSeconds(workout))}</dd></div>
          <div><dt className="text-xs text-muted">Volume</dt><dd className="tnum text-sm font-semibold">{formatVolume(workoutVolumeKg(workout), units)}</dd></div>
          <div>
            <dt className="text-xs text-muted">Records</dt>
            <dd className="tnum flex items-center gap-1 text-sm font-semibold"><Medal size={16} className="text-record" aria-hidden="true" />{records}</dd>
          </div>
        </dl>
      </Link>
      <ul className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
        {shown.map((ex) => {
          const info = exercises[ex.exerciseId];
          return (
            <li key={ex.id} className="flex items-center gap-3">
              <ExerciseThumb muscle={info?.muscle ?? "other"} />
              <span className="text-sm">{ex.sets.length} sets {info?.name ?? "Unknown exercise"}</span>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <Link href={`/history/${workout.id}`} className="mt-3 block text-center text-sm text-muted">See {more} more exercise{more === 1 ? "" : "s"}</Link>
      )}
      <p className="sr-only">{completedSetCount(workout)} sets completed</p>
    </article>
  );
}
