import { z } from "zod";
import { localDueAt } from "../date-time";
export type HealthKind = "vaccinations" | "medications";
const common = {
  id: z.uuid(),
  petId: z.uuid(),
  name: z.string().min(1).max(140),
  notes: z.string().max(2000).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
};
export const vaccinationRecordSchema = z.object({
  ...common,
  administeredAt: z.iso.datetime({ offset: true }),
  nextDueAt: z.iso.datetime({ offset: true }).nullable(),
});
export const medicationRecordSchema = z.object({
  ...common,
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }).nullable(),
});
export const healthRecordSchema = z.union([
  vaccinationRecordSchema,
  medicationRecordSchema,
]);
export type HealthRecord = z.infer<typeof healthRecordSchema>;
export type HealthInput = { name: string; notes: string | null } & (
  | { administeredAt: string; nextDueAt: string | null }
  | { startedAt: string; endedAt: string | null }
);
export const healthMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
  total: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
});
export const healthTitle = (kind: HealthKind) =>
  kind === "vaccinations" ? "Вакцинації" : "Ліки";
export const healthEmpty = (kind: HealthKind) =>
  kind === "vaccinations"
    ? "Записів про вакцинацію ще немає"
    : "Записів про ліки ще немає";
export const healthAdd = (kind: HealthKind) =>
  kind === "vaccinations" ? "Додати вакцинацію" : "Додати запис";
export const healthHref = (id: string, kind: HealthKind) =>
  "/pets/" + encodeURIComponent(id) + "/care/" + kind;
export const healthKeys = {
  pet: (uid: string, id: string, kind: HealthKind) =>
    ["pet-care", uid, id, kind] as const,
  list: (uid: string, id: string, kind: HealthKind, limit = 20) =>
    ["pet-care", uid, id, kind, limit] as const,
};
export const healthStart = (r: HealthRecord) =>
  "administeredAt" in r ? r.administeredAt : r.startedAt;
export const healthEnd = (r: HealthRecord) =>
  "nextDueAt" in r ? r.nextDueAt : r.endedAt;
export function healthInput(
  kind: HealthKind,
  name: string,
  notes: string,
  date: string,
  time: string,
  enabled: boolean,
  endDate: string,
  endTime: string,
): HealthInput {
  if (!name.trim() || name.trim().length > 140)
    throw Error("Вкажіть назву (до 140 символів).");
  if (notes.length > 2000)
    throw Error("Нотатка має містити не більше 2000 символів.");
  const start = localDueAt(date, time);
  if (!start) throw Error("Оберіть коректну дату й час.");
  if (Date.parse(start) > Date.now() + 30000)
    throw Error("Дата події не може бути в майбутньому.");
  const end = enabled ? localDueAt(endDate, endTime) : null;
  if (enabled && !end)
    throw Error("Оберіть обидва поля: додаткову дату й час.");
  if (
    end &&
    (kind === "vaccinations"
      ? Date.parse(end) <= Date.parse(start)
      : Date.parse(end) < Date.parse(start))
  )
    throw Error(
      kind === "vaccinations"
        ? "Наступна дата має бути пізніше дати вакцинації."
        : "Дата завершення не може бути раніше дати початку.",
    );
  const base = { name: name.trim(), notes: notes.trim() || null };
  return kind === "vaccinations"
    ? { ...base, administeredAt: start, nextDueAt: end }
    : { ...base, startedAt: start, endedAt: end };
}
