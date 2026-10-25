"use client";

import Link from "next/link";
import { loadDraft } from "@/lib/store";
import { useAsync } from "@/lib/hooks";

/** Shown whenever an unfinished workout exists, so closing the app mid-session never loses it. */
export function ResumeBanner() {
  const { data } = useAsync(loadDraft, null);
  if (!data) return null;
  return (
    <Link href="/live" className="mx-margin mb-4 flex items-center justify-between rounded-md bg-accent px-4 py-3 text-on-accent">
      <span>
        <span className="block text-sm font-semibold">Workout in progress</span>
        <span className="block text-xs">{data.workout.title}</span>
      </span>
      <span className="text-sm font-semibold">Resume</span>
    </Link>
  );
}
