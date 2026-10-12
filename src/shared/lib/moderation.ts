import { z } from "zod";
export const moderationSchema = z.enum([
  "NOT_SUBMITTED",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
]);
export type ModerationStatus = z.infer<typeof moderationSchema>;
type Publication = { status: string; moderationStatus: ModerationStatus };
const businessLabels: Record<string, string> = {
  DRAFT: "Чернетка",
  ACTIVE: "Активне",
  SOLD: "Продано",
  TRANSFERRED: "Передано",
  ADOPTED: "Прилаштовано",
  CLOSED: "Завершено",
  ARCHIVED: "Архів",
};
export function ownerPublication(row: Publication) {
  const terminal = !["DRAFT", "ACTIVE"].includes(row.status);
  if (row.moderationStatus === "HIDDEN")
    return {
      label: "Приховано",
      tone: "hidden",
      helper: "Оголошення приховано. Повторне надсилання недоступне.",
    };
  if (!terminal && row.moderationStatus === "PENDING")
    return {
      label: "На модерації",
      tone: "pending",
      helper: "Оголошення перевіряється перед публікацією.",
    };
  if (!terminal && row.moderationStatus === "REJECTED")
    return {
      label: "Відхилено",
      tone: "rejected",
      helper:
        "Відредагуйте оголошення та надішліть його на модерацію повторно.",
    };
  return {
    label: businessLabels[row.status] ?? "Недоступне",
    tone: row.status.toLowerCase(),
    helper: "",
  };
}
export const canEditPublication = (row: Publication) =>
  ["DRAFT", "ACTIVE"].includes(row.status) && row.moderationStatus !== "HIDDEN";
export const canSubmitPublication = (row: Publication) =>
  ["DRAFT", "ACTIVE"].includes(row.status) &&
  ["NOT_SUBMITTED", "REJECTED"].includes(row.moderationStatus);
export const isPublicPublication = (row: Publication) =>
  row.status === "ACTIVE" && row.moderationStatus === "APPROVED";
