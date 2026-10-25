"use client";

import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetRow } from "./ui";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { setLabel } from "@/lib/workout-math";
import type { SetType, WorkoutSet } from "@/lib/types";

export interface Row {
  id: string;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  completed?: boolean;
}

/** A number field that lets you type "45." or clear it without fighting you. */
function NumberCell({
  value, onChange, label, decimal, disabled,
}: { value: number | null; onChange: (v: number | null) => void; label: string; decimal: boolean; disabled?: boolean }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === null ? "" : String(value));
  }, [value, focused]);
  return (
    <input
      aria-label={label}
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      disabled={disabled}
      placeholder="-"
      onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === ".") { onChange(null); return; }
        const n = Number(raw);
        if (!Number.isNaN(n)) onChange(n);
      }}
      className="tnum h-10 w-full min-w-0 rounded-sm bg-transparent text-center text-base font-semibold text-text placeholder:text-muted focus:bg-surface-raised disabled:opacity-100"
    />
  );
}

const TYPE_OPTIONS: { type: SetType; label: string }[] = [
  { type: "normal", label: "Normal set" },
  { type: "warmup", label: "Warm-up set" },
  { type: "drop", label: "Drop set" },
  { type: "failure", label: "Failure set" },
];

export function SetTable({
  rows, units, previous, mode, onChange, onAdd, onRemove, onToggleDone, exerciseName,
}: {
  rows: Row[];
  units: "kg" | "lb";
  previous?: WorkoutSet[];
  mode: "live" | "edit";
  onChange: (index: number, patch: Partial<Row>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onToggleDone?: (index: number) => void;
  exerciseName: string;
}) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const live = mode === "live";
  const cols = live ? "grid-cols-[48px_1fr_72px_72px_56px]" : "grid-cols-[48px_72px_72px_1fr]";
  return (
    <div role="table" aria-label={`Sets for ${exerciseName}`}>
      <div role="row" className={`grid ${cols} items-center px-margin pb-2 text-2xs uppercase tracking-wide text-muted`}>
        <span role="columnheader">Set</span>
        {live && <span role="columnheader">Previous</span>}
        <span role="columnheader" className="text-center">{units}</span>
        <span role="columnheader" className="text-center">Reps</span>
        {live ? <span role="columnheader" className="text-center"><Check size={16} className="inline" aria-label="Done" /></span> : <span />}
      </div>
      {rows.map((row, i) => {
        const done = !!row.completed;
        const prev = previous?.[i];
        const label = setLabel(rows, i);
        const zebra = done ? "bg-success-surface" : i % 2 === 1 ? "bg-surface" : "bg-bg";
        return (
          <div key={row.id} role="row" className={`grid ${cols} h-[var(--set-row-height)] items-center px-margin ${zebra}`}>
            <span role="cell">
              <button type="button" onClick={() => setMenuFor(i)} aria-label={`Set ${label}, change type or delete`}
                className={`h-10 w-10 rounded-sm text-left text-base font-semibold ${row.type === "warmup" ? "text-warmup" : "text-text"}`}>
                {label}
              </button>
            </span>
            {live && (
              <span role="cell" className={`tnum truncate text-sm ${done ? "text-text" : "text-muted"}`}>
                {prev ? `${formatWeight(prev.weightKg, units)}${units} x ${prev.reps ?? "-"}` : "-"}
              </span>
            )}
            <span role="cell">
              <NumberCell decimal label={`Set ${label} weight in ${units}`}
                value={toDisplay(row.weightKg, units)}
                onChange={(v) => onChange(i, { weightKg: fromDisplay(v, units) })} />
            </span>
            <span role="cell">
              <NumberCell decimal={false} label={`Set ${label} reps`} value={row.reps}
                onChange={(v) => onChange(i, { reps: v === null ? null : Math.min(1000, Math.round(v)) })} />
            </span>
            {live ? (
              <span role="cell" className="flex justify-center">
                <button type="button" onClick={() => onToggleDone?.(i)} role="checkbox" aria-checked={done}
                  aria-label={`Set ${label} complete`}
                  className={`flex h-10 w-10 items-center justify-center rounded-sm ${done ? "bg-success text-on-success" : "bg-muted text-text"}`}>
                  <Check size={22} aria-hidden="true" />
                </button>
              </span>
            ) : (
              <span role="cell" className="flex justify-end">
                <button type="button" onClick={() => onRemove(i)} aria-label={`Delete set ${label}`}
                  className="flex h-10 w-10 items-center justify-center rounded-sm text-muted">
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        );
      })}
      <div className="px-margin pt-3">
        <button type="button" onClick={onAdd}
          className="flex h-control w-full items-center justify-center gap-2 rounded-md bg-surface text-sm font-semibold active:opacity-80">
          <span aria-hidden="true" className="text-lg leading-none">+</span> Add Set
        </button>
      </div>

      <Sheet open={menuFor !== null} onClose={() => setMenuFor(null)} title="Set options">
        <div className="overflow-hidden rounded-md">
          {TYPE_OPTIONS.map((o) => (
            <SheetRow key={o.type} onClick={() => { if (menuFor !== null) onChange(menuFor, { type: o.type }); setMenuFor(null); }}>
              {o.label}{menuFor !== null && rows[menuFor]?.type === o.type ? " (current)" : ""}
            </SheetRow>
          ))}
          <SheetRow danger icon={<Trash2 size={22} aria-hidden="true" />}
            onClick={() => { if (menuFor !== null) onRemove(menuFor); setMenuFor(null); }}>
            Delete set
          </SheetRow>
        </div>
      </Sheet>
    </div>
  );
}
