export type SubStatus = "actif" | "bientot" | "imminent" | "expire" | "aucun" | "suspendu";

export const STATUS_LABEL: Record<SubStatus, string> = {
  actif: "Actif",
  bientot: "Bientôt expiré",
  imminent: "Expiration imminente",
  expire: "Expiré",
  aucun: "Aucun abonnement",
  suspendu: "Suspendu",
};

export const STATUS_COLOR: Record<SubStatus, string> = {
  actif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  bientot: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  imminent: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  expire: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  aucun: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  suspendu: "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100",
};

/** Fin de période inclusive : un abonnement d'un jour commence et se termine le même jour. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1, d + Math.max(1, Math.round(days)) - 1));
  return end.toISOString().slice(0, 10);
}

/** Nombre de jours couverts entre deux dates, bornes incluses. */
export function daysBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const from = Date.UTC(sy, sm - 1, sd);
  const to = Date.UTC(ey, em - 1, ed);
  return Math.round((to - from) / 86400000) + 1;
}

/** Affiche 1 jour, 1 semaine, 1 an, 2 semaines, 30 jours, etc. */
export function durationParts(days: number): { value: number; unit: string } {
  const safe = Math.max(1, Math.round(days));
  if (safe % 365 === 0) return { value: safe / 365, unit: safe === 365 ? "an" : "ans" };
  if (safe % 7 === 0) return { value: safe / 7, unit: safe === 7 ? "semaine" : "semaines" };
  return { value: safe, unit: safe === 1 ? "jour" : "jours" };
}

export function durationLabel(days: number): string {
  const { value, unit } = durationParts(days);
  return `${value} ${unit}`;
}

export function daysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = endDate.split("-").map(Number);
  const e = Date.UTC(y, m - 1, d);
  return Math.round((e - t) / 86400000);
}

export function computeStatus(
  endDate: string | null | undefined,
  thresholds: { soon: number; imminent: number } = { soon: 7, imminent: 3 },
  subscriberStatus?: string,
): SubStatus {
  if (subscriberStatus === "suspendu") return "suspendu";
  if (!endDate) return "aucun";
  const dl = daysLeft(endDate);
  if (dl === null) return "aucun";
  if (dl < 0) return "expire";
  if (dl <= thresholds.imminent) return "imminent";
  if (dl <= thresholds.soon) return "bientot";
  return "actif";
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}
