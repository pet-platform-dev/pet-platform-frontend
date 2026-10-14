import { localDueAt } from "../date-time";
export { localFields, localDueAt } from "../date-time";
import { z } from "zod";
export const recurrenceOptions = [
  { value: "NONE", label: "Не повторювати" },
  { value: "DAILY", label: "Щодня" },
  { value: "WEEKLY", label: "Щотижня" },
  { value: "MONTHLY", label: "Щомісяця" },
  { value: "CUSTOM_DAYS", label: "Кожні N днів" },
] as const;
export type Recurrence = (typeof recurrenceOptions)[number]["value"];
export const reminderSchema = z.object({
  id: z.uuid(),
  petId: z.uuid(),
  title: z.string().min(1).max(120),
  notes: z.string().nullable(),
  dueAt: z.iso.datetime({ offset: true }),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM_DAYS"]),
  intervalDays: z.number().int().nullable(),
  seriesId: z.uuid().nullable(),
  status: z.enum(["PENDING", "COMPLETED"]),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const reminderPageSchema = z.object({
  data: z.array(reminderSchema).max(100),
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(100),
    total: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
  }),
});
export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderStatus = Reminder["status"];
export type ReminderInput = {
  title: string;
  notes: string | null;
  dueAt: string;
  recurrenceType: Recurrence;
  intervalDays: number | null;
};
export const remindersHref = (id: string) =>
  "/pets/" + encodeURIComponent(id) + "/care/reminders";
export const reminderKeys = {
  pet: (uid: string, id: string) => ["pet-care", uid, id, "reminders"] as const,
  list: (
    uid: string,
    id: string,
    status: ReminderStatus,
    page = 1,
    limit = 20,
  ) => ["pet-care", uid, id, "reminders", status, page, limit] as const,
};
export const recurrenceLabel = (
  r: Pick<Reminder, "recurrenceType" | "intervalDays">,
) =>
  r.recurrenceType === "CUSTOM_DAYS"
    ? `Кожні ${r.intervalDays} дн.`
    : recurrenceOptions.find((o) => o.value === r.recurrenceType)!.label;
export const overdue = (
  r: Pick<Reminder, "status" | "dueAt">,
  now = Date.now(),
) => r.status === "PENDING" && Date.parse(r.dueAt) < now;
export const reminderDate = (date: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
export function formInput(
  title: string,
  notes: string,
  date: string,
  time: string,
  recurrenceType: Recurrence,
  interval: string,
): ReminderInput {
  const dueAt = localDueAt(date, time);
  if (!title.trim() || title.trim().length > 120)
    throw Error("Вкажіть назву нагадування (до 120 символів).");
  if (!dueAt) throw Error("Оберіть коректну дату й час.");
  if (Date.parse(dueAt) < Date.now() - 30000)
    throw Error("Дата нагадування має бути в майбутньому.");
  if (notes.length > 1000)
    throw Error("Нотатка має містити не більше 1000 символів.");
  const intervalDays =
    recurrenceType === "CUSTOM_DAYS" ? Number(interval) : null;
  if (
    intervalDays !== null &&
    (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365)
  )
    throw Error("Вкажіть інтервал від 1 до 365 днів.");
  return {
    title: title.trim(),
    notes: notes.trim() || null,
    dueAt,
    recurrenceType,
    intervalDays,
  };
}
