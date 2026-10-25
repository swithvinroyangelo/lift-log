"use client";

import { Dumbbell } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Muscle } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

export function Button({
  variant = "secondary", size = "md", block = false, className = "", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-sm font-semibold text-sm transition-colors duration-fast disabled:opacity-40 disabled:pointer-events-none";
  const sizes = size === "lg" ? "h-control px-5" : "h-button px-4";
  const variants: Record<Variant, string> = {
    primary: "bg-accent text-on-accent active:opacity-80",
    secondary: "bg-surface-raised text-text active:opacity-80",
    ghost: "bg-transparent text-accent active:opacity-70",
    danger: "bg-surface-raised text-danger active:opacity-80",
  };
  return <button type="button" className={`${base} ${sizes} ${variants[variant]} ${block ? "w-full" : ""} ${className}`} {...rest} />;
}

export function IconButton({
  label, className = "", children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-pill text-text active:bg-surface-raised ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function PageHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-[56px] items-center gap-2 bg-bg px-margin pt-[env(safe-area-inset-top)]">
      {left}
      <h1 className="flex-1 truncate text-lg">{title}</h1>
      <div className="flex items-center">{right}</div>
    </header>
  );
}

/** Our own simple stand-in for the original's exercise illustrations (those are licensed content). */
export function ExerciseThumb({ muscle, size = 40 }: { muscle: Muscle; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-pill"
      style={{ width: size, height: size, color: `var(--muscle-${muscle.replace("_", "-")})`, background: `color-mix(in srgb, var(--muscle-${muscle.replace("_", "-")}) 20%, transparent)` }}>
      <Dumbbell size={size * 0.5} />
    </span>
  );
}

/** Bottom sheet with a focus trap-lite: focuses the first control, closes on Escape or a tap on the dimmed page. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = Array.from(ref.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")).filter((x) => !x.hasAttribute("disabled"));
        if (f.length === 0) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-scrim/50" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative w-full max-w-[480px] rounded-t-[var(--sheet-radius)] bg-sheet px-margin pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-muted" aria-hidden="true" />
        <h2 id={titleId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SheetRow({
  icon, children, danger = false, onClick,
}: { icon?: ReactNode; children: ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex h-[56px] w-full items-center gap-4 border-b border-border bg-surface px-4 text-left text-base font-normal first:rounded-t-md last:rounded-b-md last:border-b-0 ${danger ? "text-danger" : "text-text"}`}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel = "Cancel", danger = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; cancelLabel?: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-base">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant={danger ? "danger" : "primary"} size="lg" block onClick={onConfirm}>{confirmLabel}</Button>
        <Button variant="secondary" size="lg" block onClick={onCancel}>{cancelLabel}</Button>
      </div>
    </Sheet>
  );
}

export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-margin py-12 text-center">
      <p className="text-sm text-muted">{message}</p>
      {children}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+24px)] z-40 mx-auto w-fit max-w-[90%] rounded-md bg-surface-raised px-4 py-3 text-sm">
      {message}
    </div>
  );
}
