const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const plurals = new Intl.PluralRules("uk-UA");
export function formatPetAge(
  birthDate: string | null,
  now = new Date(),
): string | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const date = new Date(`${birthDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== birthDate
  )
    return null;
  const parts = dateFormatter.formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const [year, month, day] = birthDate.split("-").map(Number);
  let months = (value("year") - year) * 12 + value("month") - month;
  if (value("day") < day) months--;
  if (months < 0) return null;
  if (months < 1) return "Менше місяця";
  if (months < 12) return `${months} міс.`;
  const years = Math.floor(months / 12);
  const ending = plurals.select(years);
  return `${years} ${ending === "one" ? "рік" : ending === "few" ? "роки" : "років"}`;
}
