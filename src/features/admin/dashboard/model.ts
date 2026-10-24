import { z } from "zod";
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const dashboardSchema = z.object({
  asOf: z.iso.datetime(),
  metrics: z.object({
    users: count,
    breederProfiles: count,
    pets: count,
    listings: count,
    activeListings: count,
    matingListings: count,
    openReports: count,
    newUsers7Days: count,
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export const metricLabels: Record<
  keyof Dashboard["metrics"],
  { title: string; description: string }
> = {
  users: { title: "Користувачі", description: "Усі зареєстровані акаунти" },
  breederProfiles: {
    title: "Розплідники",
    description: "Усі створені профілі розплідників",
  },
  pets: {
    title: "Тварини",
    description: "Усі профілі тварин, незалежно від оголошень",
  },
  listings: {
    title: "Оголошення",
    description: "Усі оголошення, включно з чернетками й архівом",
  },
  activeListings: {
    title: "Активні оголошення",
    description: "Активні та схвалені модерацією",
  },
  matingListings: {
    title: "Оголошення про в’язку",
    description: "Усі статуси оголошень про в’язку",
  },
  openReports: {
    title: "Відкриті скарги",
    description: "Скарги зі статусом «Відкрито»",
  },
  newUsers7Days: {
    title: "Нові користувачі",
    description: "Реєстрації за останні 7 діб",
  },
};
