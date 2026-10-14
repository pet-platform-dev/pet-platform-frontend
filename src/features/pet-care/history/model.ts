import { z } from "zod";
import { localDueAt } from "../date-time";
export const historyTypes = [
  { value: "VET_VISIT", label: "Візит до ветеринара" },
  { value: "GROOMING", label: "Грумінг" },
  { value: "HYGIENE", label: "Гігієна" },
  { value: "PARASITE_TREATMENT", label: "Обробка від паразитів" },
  { value: "TRAINING", label: "Тренування / заняття" },
  { value: "OTHER", label: "Інше" },
] as const;
export type EntryType = (typeof historyTypes)[number]["value"];
export type HistoryFilter = EntryType | "ALL";
export const historyFilters = [
  { value: "ALL", label: "Усі типи" },
  ...historyTypes,
] as const;
export const historyEntrySchema = z.object({
  id: z.uuid(),
  petId: z.uuid(),
  type: z.enum([
    "VET_VISIT",
    "GROOMING",
    "HYGIENE",
    "PARASITE_TREATMENT",
    "TRAINING",
    "OTHER",
  ]),
  title: z.string().min(1).max(140),
  occurredAt: z.iso.datetime({ offset: true }),
  notes: z.string().max(2000).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const historyPageSchema = z.object({
  data: z.array(historyEntrySchema).max(100),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type CareEntry = z.infer<typeof historyEntrySchema>;
export type EntryInput = Pick<
  CareEntry,
  "type" | "title" | "notes" | "occurredAt"
>;
export const historyHref = (id: string) =>
  "/pets/" + encodeURIComponent(id) + "/care/history";
export const historyKeys = {
  pet: (uid: string, id: string) => ["pet-care", uid, id, "history"] as const,
  list: (uid: string, id: string, type: HistoryFilter = "ALL", limit = 20) =>
    ["pet-care", uid, id, "history", type, limit] as const,
};
export const historyTypeLabel = (type: EntryType) =>
  historyTypes.find((t) => t.value === type)!.label;
export function historyInput(
  type: EntryType,
  title: string,
  notes: string,
  date: string,
  time: string,
): EntryInput {
  const occurredAt = localDueAt(date, time);
  if (!title.trim() || title.trim().length > 140)
    throw Error("Вкажіть назву запису (до 140 символів).");
  if (!occurredAt) throw Error("Оберіть коректну дату й час.");
  if (Date.parse(occurredAt) > Date.now() + 30000)
    throw Error("Дата події не може бути в майбутньому.");
  if (notes.length > 2000)
    throw Error("Нотатка має містити не більше 2000 символів.");
  return { type, title: title.trim(), notes: notes.trim() || null, occurredAt };
}
