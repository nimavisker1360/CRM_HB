import { BUSINESS_TIME_ZONE } from "@/services/automation/automation.config";

function partsFor(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    month: Number(byType.month),
    second: Number(byType.second),
    year: Number(byType.year),
  };
}

function offsetMs(timeZone: string, date: Date) {
  const parts = partsFor(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedTimeToUtc(timeZone: string, year: number, month: number, day: number, hour = 0) {
  let utc = new Date(Date.UTC(year, month - 1, day, hour));
  for (let index = 0; index < 2; index += 1) {
    utc = new Date(Date.UTC(year, month - 1, day, hour) - offsetMs(timeZone, utc));
  }
  return utc;
}

export function getBusinessDayKey(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = partsFor(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getBusinessTodayBounds(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = partsFor(date, timeZone);
  const start = zonedTimeToUtc(timeZone, parts.year, parts.month, parts.day, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { end, start };
}
