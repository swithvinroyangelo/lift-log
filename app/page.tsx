"use client";

import Link from "next/link";
import { ResumeBanner } from "@/components/resume-banner";
import { Button, EmptyState, PageHeader } from "@/components/ui";
import { WorkoutCard } from "@/components/workout-card";
import { useAsync, useSettings } from "@/lib/hooks";
import { getExerciseMap, listWorkouts } from "@/lib/store";
import type { Workout } from "@/lib/types";

export default function Home() {
  const workouts = useAsync(listWorkouts, [] as Workout[]);
  const exercises = useAsync(getExerciseMap, {});
  const settings = useSettings();
  return (
    <main>
      <PageHeader title="Home" />
      <ResumeBanner />
      {workouts.ready && workouts.data.length === 0 ? (
        <EmptyState message="Nothing logged yet. Your finished workouts will show up here.">
          <Link href="/workout"><Button variant="primary" size="lg">Go to Workout</Button></Link>
        </EmptyState>
      ) : (
        <div>
          {workouts.data.map((w) => (
            <WorkoutCard key={w.id} workout={w} all={workouts.data} exercises={exercises.data} units={settings.units} />
          ))}
        </div>
      )}
    </main>
  );
}
