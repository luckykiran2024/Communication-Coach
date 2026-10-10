export function dayKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function nextReset(date: Date, timezone: string) {
  const current = dayKey(date, timezone);
  for (let minute = 1; minute <= 36 * 60; minute++) {
    const candidate = new Date(date.getTime() + minute * 60_000);
    if (dayKey(candidate, timezone) !== current) return candidate.toISOString();
  }
  return new Date(date.getTime() + 24 * 60 * 60_000).toISOString();
}

export function elapsedSeconds(startedAt: Date, endedAt: Date, maximumSeconds: number) {
  return Math.min(maximumSeconds, Math.max(0, Math.ceil((endedAt.getTime() - startedAt.getTime()) / 1000)));
}

export function monthKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

export function nextMonthReset(date: Date, timezone: string) {
  const currentMonth = monthKey(date, timezone);
  let low = date.getTime();
  let high = low + 32 * 24 * 60 * 60_000;
  while (monthKey(new Date(high), timezone) === currentMonth) high += 24 * 60 * 60_000;
  while (high - low > 60_000) {
    const midpoint = Math.floor((low + high) / 120_000) * 60_000;
    if (monthKey(new Date(midpoint), timezone) === currentMonth) low = midpoint;
    else high = midpoint;
  }
  return new Date(high).toISOString();
}
