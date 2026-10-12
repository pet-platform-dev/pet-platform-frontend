import {
  customAgeValue,
  customAgeRange,
} from "@/features/listing/filters/filter-age-range";
import type { MatingCatalogQuery } from "./query";
export const matingAgeOptions = [
  { value: "", label: "Будь-який вік" },
  { value: "range::12", label: "До 1 року" },
  { value: "12-24", label: "1–2 роки" },
  { value: "range:24:48", label: "2–4 роки" },
  { value: "range:48:72", label: "4–6 років" },
  { value: "range:72:", label: "6+ років" },
];
export function matingAgeValue(query: MatingCatalogQuery) {
  if (query.ageMinMonths === 12 && query.ageMaxMonths === 24) return "12-24";
  return customAgeValue({ ...query });
}
const amount = (months: number) =>
  months % 12 === 0 && months > 0
    ? `${months / 12} ${months === 12 ? "року" : "років"}`
    : `${months} ${months === 1 ? "місяця" : "місяців"}`;
export function matingAgeChoices(value: string) {
  if (matingAgeOptions.some((option) => option.value === value))
    return matingAgeOptions;
  const { ageMinMonths: min, ageMaxMonths: max } = customAgeRange(value);
  if (min === undefined && max === undefined) return matingAgeOptions;
  const label =
    max === undefined
      ? min
        ? `Від ${amount(min)}`
        : "Вік зазначено"
      : !min
        ? max === 0
          ? "Менше 1 місяця"
          : `До ${amount(max)}`
        : `Від ${amount(min)} до ${amount(max)}`;
  return [...matingAgeOptions, { value, label }];
}
