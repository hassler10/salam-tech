import { DEMO_MODE } from "./demo";

export const LIBRARY_TIME_ZONE = "Africa/Abidjan";
export const LIBRARY_OPEN_MINUTES = 8 * 60;
export const LIBRARY_CLOSE_MINUTES = 16 * 60;

export function getLibraryClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LIBRARY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    day: `${value.year}-${value.month}-${value.day}`,
    hour: Number(value.hour),
    minute: Number(value.minute),
    minuteOfDay: Number(value.hour) * 60 + Number(value.minute),
  };
}

export function isLibraryOpen(date = new Date()) {
  if (DEMO_MODE) return true;
  const minute = getLibraryClock(date).minuteOfDay;
  return minute >= LIBRARY_OPEN_MINUTES && minute < LIBRARY_CLOSE_MINUTES;
}

export function getLibraryDayBounds(day: string) {
  // Abidjan reste à UTC+0 toute l'année.
  return {
    openAt: new Date(`${day}T08:00:00.000Z`),
    closeAt: new Date(`${day}T16:00:00.000Z`),
  };
}
