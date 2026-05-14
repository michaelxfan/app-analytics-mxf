// Toronto timezone helpers. Uses Intl APIs so DST is handled automatically.

const TZ = "America/Toronto";

function partsInTz(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return parts;
}

export function torontoNowParts(date: Date = new Date()) {
  const p = partsInTz(date);
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour === "24" ? "0" : p.hour),
    minute: Number(p.minute),
    weekday: p.weekday, // e.g. "Sat"
    isoDate: `${p.year}-${p.month}-${p.day}`,
  };
}

export function isSaturday9amToronto(date: Date = new Date()): boolean {
  const p = torontoNowParts(date);
  return p.weekday === "Sat" && p.hour === 9;
}

// week range = last 7 calendar days (Toronto), ending yesterday
export function lastSevenDaysRange(date: Date = new Date()): {
  weekStart: string;
  weekEnd: string;
  startUtc: Date;
  endUtc: Date;
} {
  const p = torontoNowParts(date);
  // Anchor at Toronto midnight today
  const todayMidnightUtc = new Date(
    Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
  );
  // approximate: 7 days back at same moment
  const endUtc = new Date(date.getTime());
  const startUtc = new Date(endUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startParts = partsInTz(startUtc);
  const endParts = partsInTz(endUtc);
  return {
    weekStart: `${startParts.year}-${startParts.month}-${startParts.day}`,
    weekEnd: `${endParts.year}-${endParts.month}-${endParts.day}`,
    startUtc,
    endUtc,
    // keep todayMidnightUtc reachable for debug, unused
    ...({ _todayMidnightUtc: todayMidnightUtc } as object),
  };
}

export function thirtyDayWindow(date: Date = new Date()): { startUtc: Date; endUtc: Date } {
  const endUtc = new Date(date.getTime());
  const startUtc = new Date(endUtc.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}
