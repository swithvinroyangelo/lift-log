"use client";

import { useEffect, useRef } from "react";
import { Button } from "./ui";
import { useNow } from "@/lib/hooks";
import { formatMmSs } from "@/lib/workout-math";
import type { RestTimer } from "@/lib/types";

/**
 * Docked at the bottom while a rest is running. Remaining time comes from `endsAt` (a clock time),
 * so a locked phone or a background tab cannot make it drift.
 */
export function RestTimerPanel({
  rest, onChange,
}: { rest: RestTimer; onChange: (r: RestTimer | null) => void }) {
  const now = useNow(250);
  const remaining = Math.max(0, (rest.endsAt - now) / 1000);
  const done = remaining <= 0;
  const buzzed = useRef(false);

  useEffect(() => {
    if (!done) { buzzed.current = false; return; }
    if (!buzzed.current) {
      buzzed.current = true;
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* not supported */ }
    }
    const t = setTimeout(() => onChange(null), 3000);
    return () => clearTimeout(t);
  }, [done, onChange]);

  const pct = Math.min(100, Math.max(0, 100 - (remaining / rest.totalSeconds) * 100));
  return (
    <div role="timer" aria-label="Rest timer" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="h-1 w-full bg-surface-raised" aria-hidden="true">
        <div className="h-full bg-accent transition-[width] duration-base" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex h-[var(--rest-panel-height)] items-center gap-3 px-margin">
        <Button variant="secondary" size="lg" aria-label="Subtract 15 seconds"
          onClick={() => onChange({ ...rest, endsAt: rest.endsAt - 15_000, totalSeconds: Math.max(1, rest.totalSeconds - 15) })}>-15</Button>
        <div className="tnum flex-1 text-center text-xl" aria-live="off">{done ? "Rest over" : formatMmSs(remaining)}</div>
        <Button variant="secondary" size="lg" aria-label="Add 15 seconds"
          onClick={() => onChange({ ...rest, endsAt: rest.endsAt + 15_000, totalSeconds: rest.totalSeconds + 15 })}>+15</Button>
        <Button variant="primary" size="lg" onClick={() => onChange(null)}>Skip</Button>
      </div>
    </div>
  );
}
