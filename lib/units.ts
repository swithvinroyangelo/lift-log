const LB_PER_KG = 2.20462262;

/** kg stored -> number shown. Rounded to 0.5 for lb (plates), 0.1 for kg display. */
export function toDisplay(kg: number | null, units: "kg" | "lb"): number | null {
  if (kg === null || Number.isNaN(kg)) return null;
  if (units === "kg") return Math.round(kg * 100) / 100;
  // 135 lb -> 61.23 kg -> 134.99 lb if shown to 2 decimals, so snap to the nearest 0.5 lb.
  return Math.round(kg * LB_PER_KG * 2) / 2;
}

/** number typed -> kg stored, rounded to 2 decimals like the database column. */
export function fromDisplay(value: number | null, units: "kg" | "lb"): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (units === "kg") return Math.round(value * 100) / 100;
  return Math.round((value / LB_PER_KG) * 100) / 100;
}

export function formatWeight(kg: number | null, units: "kg" | "lb"): string {
  const v = toDisplay(kg, units);
  if (v === null) return "-";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, "");
  return s;
}

export function formatVolume(kgTotal: number, units: "kg" | "lb"): string {
  const v = units === "kg" ? Math.round(kgTotal) : Math.round(kgTotal * LB_PER_KG);
  return `${v.toLocaleString("en-US")} ${units}`;
}
