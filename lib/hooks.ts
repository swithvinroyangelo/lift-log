"use client";

import { useCallback, useEffect, useState } from "react";
import { getSettings } from "./store";
import { DEFAULT_SETTINGS } from "./types";
import type { Settings } from "./types";

/** Loads async data once on mount and exposes a reload function. `ready` is false until the first load ends. */
export function useAsync<T>(load: () => Promise<T>, initial: T): { data: T; ready: boolean; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    load().then((d) => {
      if (alive) { setData(d); setReady(true); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, ready, reload };
}

export function useSettings(): Settings {
  const { data } = useAsync(getSettings, DEFAULT_SETTINGS);
  return data;
}

/** Re-renders every `ms` milliseconds (for running clocks). */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, active]);
  return now;
}
