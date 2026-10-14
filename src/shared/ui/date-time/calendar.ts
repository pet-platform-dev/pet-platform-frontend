export const calendarMonths = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];
export const calendarWeekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
export function calendarParts(value: string) {
  const d = new Date(value + "T12:00:00Z");
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
  };
}
export function calendarDate(year: number, month: number, day: number) {
  const d = new Date(0);
  d.setUTCFullYear(year, month, day);
  return d.toISOString().slice(0, 10);
}
export function monthLength(year: number, month: number) {
  return calendarParts(calendarDate(year, month + 1, 0)).day;
}
export function calendarMonth(value: string, year: number, month: number) {
  const { day } = calendarParts(value);
  return calendarDate(year, month, Math.min(day, monthLength(year, month)));
}
export function moveCalendar(value: string, days: number) {
  const p = calendarParts(value);
  return calendarDate(p.year, p.month, p.day + days);
}
export function monthCells(value: string) {
  const { year, month } = calendarParts(value),
    first = new Date(calendarDate(year, month, 1) + "T12:00:00Z"),
    offset = (first.getUTCDay() + 6) % 7,
    count = monthLength(year, month);
  return Array.from({ length: 42 }, (_, i) =>
    i >= offset && i < offset + count
      ? calendarDate(year, month, i - offset + 1)
      : null,
  );
}
export function calendarLabel(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}
export function dateButtonLabel(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").reverse().join(".")
    : "Оберіть дату";
}
export const timeHours = Array.from({ length: 24 }, (_, n) => ({
  value: String(n).padStart(2, "0"),
  label: String(n).padStart(2, "0"),
}));
export const timeMinutes = Array.from({ length: 60 }, (_, n) => ({
  value: String(n).padStart(2, "0"),
  label: String(n).padStart(2, "0"),
}));
