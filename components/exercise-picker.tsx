"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, EmptyState, ExerciseThumb, Sheet, SheetRow } from "./ui";
import { newId } from "@/lib/ids";
import { createExercise } from "@/lib/store";
import { EQUIPMENT, MUSCLES } from "@/lib/types";
import type { Equipment, Exercise, Muscle } from "@/lib/types";

const pretty = (s: string) => s.replace("_", " ").replace(/^./, (c) => c.toUpperCase());

/** Full-screen picker used for Add (pick several) and Replace (pick one). */
export function ExercisePicker({
  open, title, exercises, recentIds, multi, onClose, onPick, onCreated,
}: {
  open: boolean; title: string; exercises: Exercise[]; recentIds: string[]; multi: boolean;
  onClose: () => void; onPick: (ids: string[]) => void; onCreated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<Equipment | "all">("all");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const [chosen, setChosen] = useState<string[]>([]);
  const [filterSheet, setFilterSheet] = useState<"equipment" | "muscle" | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) =>
      (equipment === "all" || e.equipment === equipment) &&
      (muscle === "all" || e.muscle === muscle) &&
      (q === "" || e.name.toLowerCase().includes(q)));
  }, [exercises, query, equipment, muscle]);

  const recent = useMemo(
    () => recentIds.map((id) => filtered.find((e) => e.id === id)).filter((e): e is Exercise => !!e).slice(0, 5),
    [recentIds, filtered],
  );

  if (!open) return null;

  const toggle = (id: string) => {
    if (!multi) { onPick([id]); reset(); return; }
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };
  const reset = () => { setChosen([]); setQuery(""); setEquipment("all"); setMuscle("all"); };

  const Row = ({ e }: { e: Exercise }) => {
    const on = chosen.includes(e.id);
    return (
      <li>
        <button type="button" onClick={() => toggle(e.id)} aria-pressed={multi ? on : undefined}
          className={`flex w-full items-center gap-3 border-b border-border px-margin py-3 text-left ${on ? "bg-surface-raised" : ""}`}>
          <ExerciseThumb muscle={e.muscle} size={44} />
          <span className="flex-1">
            <span className="block text-sm text-text">{e.name}</span>
            <span className="block text-xs text-muted">{pretty(e.muscle)}</span>
          </span>
          {on && <span className="text-xs font-semibold text-accent">Selected</span>}
        </button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-[480px] flex-col bg-bg" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-14 items-center justify-between bg-surface px-margin pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <h2 className="text-base">{title}</h2>
        <Button variant="ghost" onClick={() => setCreating(true)}>Create</Button>
      </div>

      <div className="px-margin pt-4">
        <label className="flex h-control items-center gap-3 rounded-md bg-surface-raised px-4">
          <Search size={20} className="text-muted" aria-hidden="true" />
          <span className="sr-only">Search exercises</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercise"
            className="h-full flex-1 bg-transparent text-text placeholder:text-muted focus:outline-none" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <Button variant="secondary" size="lg" onClick={() => setFilterSheet("equipment")}>
            {equipment === "all" ? "All Equipment" : pretty(equipment)}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setFilterSheet("muscle")}>
            {muscle === "all" ? "All Muscles" : pretty(muscle)}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto pb-24">
        {filtered.length === 0 ? (
          <EmptyState message="Nothing matches. You can create it.">
            <Button variant="primary" onClick={() => setCreating(true)}>Create exercise</Button>
          </EmptyState>
        ) : (
          <>
            {recent.length > 0 && query === "" && (
              <section aria-label="Recent exercises">
                <h3 className="px-margin pb-1 pt-2 text-sm font-normal text-muted">Recent</h3>
                <ul>{recent.map((e) => <Row key={"r" + e.id} e={e} />)}</ul>
              </section>
            )}
            <section aria-label="All exercises">
              <h3 className="px-margin pb-1 pt-4 text-sm font-normal text-muted">All exercises ({filtered.length})</h3>
              <ul>{filtered.map((e) => <Row key={e.id} e={e} />)}</ul>
            </section>
          </>
        )}
      </div>

      {multi && chosen.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 bg-bg px-margin pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
          <Button variant="primary" size="lg" block onClick={() => { onPick(chosen); reset(); }}>
            Add {chosen.length} exercise{chosen.length === 1 ? "" : "s"}
          </Button>
        </div>
      )}

      <Sheet open={filterSheet !== null} onClose={() => setFilterSheet(null)} title="Filter">
        <div className="max-h-[60dvh] overflow-y-auto rounded-md">
          {filterSheet === "equipment" && (
            <>
              <SheetRow onClick={() => { setEquipment("all"); setFilterSheet(null); }}>All Equipment</SheetRow>
              {EQUIPMENT.map((q) => <SheetRow key={q} onClick={() => { setEquipment(q); setFilterSheet(null); }}>{pretty(q)}</SheetRow>)}
            </>
          )}
          {filterSheet === "muscle" && (
            <>
              <SheetRow onClick={() => { setMuscle("all"); setFilterSheet(null); }}>All Muscles</SheetRow>
              {MUSCLES.map((m) => <SheetRow key={m} onClick={() => { setMuscle(m); setFilterSheet(null); }}>{pretty(m)}</SheetRow>)}
            </>
          )}
        </div>
      </Sheet>

      <CreateExercise open={creating} initialName={query} onClose={() => setCreating(false)}
        onDone={(id) => { setCreating(false); onCreated(); if (multi) setChosen((c) => [...c, id]); else { onPick([id]); reset(); } }} />
    </div>
  );
}

function CreateExercise({
  open, initialName, onClose, onDone,
}: { open: boolean; initialName: string; onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<Muscle>("chest");
  const [equipment, setEquipment] = useState<Equipment>("barbell");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title="Create exercise">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const id = newId();
          const r = await createExercise({ id, name: name || initialName, muscle, equipment, custom: true });
          if (!r.ok) { setError(r.error); return; }
          setName(""); setError(null); onDone(id);
        }}
        className="flex flex-col gap-3"
      >
        <label className="text-sm text-muted">Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={initialName || "Exercise name"}
            className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text" />
        </label>
        <label className="text-sm text-muted">Muscle
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}
            className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text">
            {MUSCLES.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">Equipment
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}
            className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text">
            {EQUIPMENT.map((q) => <option key={q} value={q}>{pretty(q)}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-danger">! {error}</p>}
        <Button variant="primary" size="lg" block type="submit">Save exercise</Button>
      </form>
    </Sheet>
  );
}
