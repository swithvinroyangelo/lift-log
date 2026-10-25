"use client";

import {
  ChevronDown, ChevronRight, ClipboardList, Copy, FolderInput, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResumeBanner } from "@/components/resume-banner";
import { Button, ConfirmDialog, EmptyState, IconButton, PageHeader, Sheet, SheetRow } from "@/components/ui";
import { newId } from "@/lib/ids";
import { useAsync } from "@/lib/hooks";
import {
  clearDraft, deleteFolder, deleteRoutine, getExerciseMap, listFolders, listRoutines, loadDraft, saveFolder, saveRoutine,
} from "@/lib/store";
import type { Exercise, Routine, RoutineFolder } from "@/lib/types";

function RoutineCard({
  routine, exercises, onStart, onMenu,
}: { routine: Routine; exercises: Record<string, Exercise>; onStart: () => void; onMenu: () => void }) {
  const names = routine.exercises.map((e) => exercises[e.exerciseId]?.name ?? "Unknown exercise").join(", ");
  return (
    <li className="rounded-md bg-surface p-card">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base">{routine.name}</h3>
        <IconButton label={`Options for ${routine.name}`} className="-mr-2 -mt-2" onClick={onMenu}>
          <MoreHorizontal size={22} aria-hidden="true" />
        </IconButton>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{names || "No exercises yet"}</p>
      <Button variant="primary" block className="mt-4" aria-label={`Start ${routine.name}`}
        disabled={routine.exercises.length === 0} onClick={onStart}>
        Start Routine
      </Button>
    </li>
  );
}

export default function WorkoutTab() {
  const router = useRouter();
  const routines = useAsync(listRoutines, [] as Routine[]);
  const folders = useAsync(listFolders, [] as RoutineFolder[]);
  const exercises = useAsync(getExerciseMap, {});
  const [open, setOpen] = useState(true);
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<Routine | null>(null);
  const [moving, setMoving] = useState<Routine | null>(null);
  const [folderMenu, setFolderMenu] = useState<RoutineFolder | null>(null);
  const [folderForm, setFolderForm] = useState<null | { id: string | null; name: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<Routine | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<RoutineFolder | null>(null);
  const [pendingStart, setPendingStart] = useState<string | null>(null); // "empty" or a routine id

  async function start(target: string) {
    const draft = await loadDraft();
    if (draft) { setPendingStart(target); return; }
    go(target);
  }
  function go(target: string) {
    router.push(target === "empty" ? "/live?new=empty" : `/live?routine=${target}`);
  }
  const reloadAll = () => { routines.reload(); folders.reload(); };

  const loose = routines.data.filter((r) => !r.folderId || !folders.data.some((f) => f.id === r.folderId));
  const inFolder = (id: string) => routines.data.filter((r) => r.folderId === id);

  return (
    <main>
      <PageHeader title="Workout" />
      <ResumeBanner />
      <div className="px-margin">
        <Button variant="secondary" size="lg" block className="!justify-start px-4 !font-normal" onClick={() => start("empty")}>
          <Plus size={22} aria-hidden="true" /> Start Empty Workout
        </Button>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-base">Routines</h2>
          <IconButton label="New folder" className="-mr-2" onClick={() => setFolderForm({ id: null, name: "" })}>
            <FolderPlus size={24} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4">
          <Link href="/routine/new" className="flex h-control items-center gap-3 rounded-sm bg-surface px-4 text-sm font-semibold active:opacity-80">
            <ClipboardList size={22} aria-hidden="true" /> New Routine
          </Link>
        </div>

        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="mt-6 flex h-11 items-center gap-2 text-sm text-muted">
          {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
          My Routines ({routines.data.length})
        </button>

        {open && routines.ready && routines.data.length === 0 && folders.data.length === 0 && (
          <EmptyState message="No routines yet. Make one and it stays here, no matter how many you add." />
        )}

        {open && folders.data.map((f) => {
          const list = inFolder(f.id);
          const isOpen = folderOpen[f.id] ?? true;
          return (
            <section key={f.id} aria-label={`Folder ${f.name}`} className="mb-4">
              <div className="flex items-center justify-between">
                <button type="button" aria-expanded={isOpen} onClick={() => setFolderOpen({ ...folderOpen, [f.id]: !isOpen })}
                  className="flex h-11 items-center gap-2 text-base">
                  {isOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                  {f.name} ({list.length})
                </button>
                <IconButton label={`Options for folder ${f.name}`} className="-mr-2" onClick={() => setFolderMenu(f)}>
                  <MoreHorizontal size={22} aria-hidden="true" />
                </IconButton>
              </div>
              {isOpen && (list.length === 0
                ? <p className="pb-2 text-sm text-muted">Empty. Move a routine here from its options menu.</p>
                : <ul className="flex flex-col gap-4">
                    {list.map((r) => (
                      <RoutineCard key={r.id} routine={r} exercises={exercises.data} onStart={() => start(r.id)} onMenu={() => setMenu(r)} />
                    ))}
                  </ul>)}
            </section>
          );
        })}

        {open && loose.length > 0 && (
          <section aria-label={folders.data.length > 0 ? "Routines not in a folder" : "Routines"}>
            {folders.data.length > 0 && <h3 className="pb-2 text-sm font-normal text-muted">Not in a folder ({loose.length})</h3>}
            <ul className="flex flex-col gap-4">
              {loose.map((r) => (
                <RoutineCard key={r.id} routine={r} exercises={exercises.data} onStart={() => start(r.id)} onMenu={() => setMenu(r)} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title="Routine options">
        <div className="overflow-hidden rounded-md">
          <SheetRow icon={<Pencil size={22} aria-hidden="true" />} onClick={() => { const id = menu?.id; setMenu(null); router.push(`/routine/${id}`); }}>Edit routine</SheetRow>
          <SheetRow icon={<FolderInput size={22} aria-hidden="true" />} onClick={() => { setMoving(menu); setMenu(null); }}>Move to folder</SheetRow>
          <SheetRow icon={<Copy size={22} aria-hidden="true" />} onClick={async () => {
            if (menu) {
              await saveRoutine({ ...menu, id: newId(), name: `${menu.name} (copy)`, exercises: menu.exercises.map((e) => ({ ...e, id: newId() })) });
              reloadAll();
            }
            setMenu(null);
          }}>Duplicate</SheetRow>
          <SheetRow danger icon={<Trash2 size={22} aria-hidden="true" />} onClick={() => { setConfirmDelete(menu); setMenu(null); }}>Delete routine</SheetRow>
        </div>
      </Sheet>

      <Sheet open={moving !== null} onClose={() => setMoving(null)} title="Move to folder">
        <div className="max-h-[60dvh] overflow-y-auto rounded-md">
          <SheetRow onClick={async () => { if (moving) await saveRoutine({ ...moving, folderId: null }); setMoving(null); reloadAll(); }}>
            No folder{moving && !moving.folderId ? " (current)" : ""}
          </SheetRow>
          {folders.data.map((f) => (
            <SheetRow key={f.id} onClick={async () => { if (moving) await saveRoutine({ ...moving, folderId: f.id }); setMoving(null); reloadAll(); }}>
              {f.name}{moving?.folderId === f.id ? " (current)" : ""}
            </SheetRow>
          ))}
        </div>
        {folders.data.length === 0 && <p className="pt-3 text-sm text-muted">You have no folders yet. Use the folder button next to "Routines" to make one.</p>}
      </Sheet>

      <Sheet open={folderMenu !== null} onClose={() => setFolderMenu(null)} title="Folder options">
        <div className="overflow-hidden rounded-md">
          <SheetRow icon={<Pencil size={22} aria-hidden="true" />} onClick={() => { if (folderMenu) setFolderForm({ id: folderMenu.id, name: folderMenu.name }); setFolderMenu(null); }}>Rename folder</SheetRow>
          <SheetRow danger icon={<Trash2 size={22} aria-hidden="true" />} onClick={() => { setConfirmDeleteFolder(folderMenu); setFolderMenu(null); }}>Delete folder</SheetRow>
        </div>
      </Sheet>

      <Sheet open={folderForm !== null} onClose={() => setFolderForm(null)} title={folderForm?.id ? "Rename folder" : "New folder"}>
        <form className="flex flex-col gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const name = folderForm?.name.trim();
          if (!folderForm || !name) return;
          const existing = folders.data.find((f) => f.id === folderForm.id);
          await saveFolder({ id: folderForm.id ?? newId(), name, position: existing?.position ?? folders.data.length });
          setFolderForm(null);
          reloadAll();
        }}>
          <label className="text-sm text-muted">Folder name
            <input value={folderForm?.name ?? ""} onChange={(e) => setFolderForm(folderForm ? { ...folderForm, name: e.target.value } : folderForm)}
              className="mt-1 h-control w-full rounded-sm border border-border-input bg-surface px-3 text-text" />
          </label>
          <Button variant="primary" size="lg" block type="submit">Save folder</Button>
        </form>
      </Sheet>

      <ConfirmDialog open={confirmDelete !== null} danger title={`Delete ${confirmDelete?.name ?? "routine"}?`}
        body="Workouts you already did from it stay in your history."
        confirmLabel="Delete routine"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => { if (confirmDelete) await deleteRoutine(confirmDelete.id); setConfirmDelete(null); reloadAll(); }} />

      <ConfirmDialog open={confirmDeleteFolder !== null} danger title={`Delete folder ${confirmDeleteFolder?.name ?? ""}?`}
        body="The routines inside are kept. They just move out of the folder."
        confirmLabel="Delete folder"
        onCancel={() => setConfirmDeleteFolder(null)}
        onConfirm={async () => { if (confirmDeleteFolder) await deleteFolder(confirmDeleteFolder.id); setConfirmDeleteFolder(null); reloadAll(); }} />

      <ConfirmDialog open={pendingStart !== null} title="You have a workout in progress"
        body="Resume it, or throw it away and start the new one."
        confirmLabel="Resume current workout" cancelLabel="Discard it and start new"
        onConfirm={() => { setPendingStart(null); router.push("/live"); }}
        onCancel={async () => { const t = pendingStart; setPendingStart(null); await clearDraft(); if (t) go(t); }} />
    </main>
  );
}
