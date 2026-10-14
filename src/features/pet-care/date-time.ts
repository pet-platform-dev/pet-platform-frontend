export function localFields(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600000),
    pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}
export function localDueAt(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return null;
  const d = new Date(date + "T" + time + ":00");
  if (!Number.isFinite(d.getTime())) return null;
  const roundtrip = localFields(d.toISOString());
  return roundtrip.date === date && roundtrip.time === time
    ? d.toISOString()
    : null;
}

export const careDate = (date: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date(date));
