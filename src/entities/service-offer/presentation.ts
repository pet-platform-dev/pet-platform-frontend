import type { ServiceOffer } from "./model";
export const providerKindLabels = {
  INDIVIDUAL: "Спеціаліст",
  ORGANIZATION: "Організація",
};
export const serviceModeLabels = {
  ONSITE: "За адресою надавача",
  MOBILE: "З виїздом",
  REMOTE: "Дистанційно",
};
const units = {
  SERVICE: "послугу",
  VISIT: "візит",
  SESSION: "заняття",
  HOUR: "годину",
  DAY: "день",
  TRIP: "поїздку",
  KM: "км",
};
export function servicePrice(price: ServiceOffer["price"]) {
  if (price.mode === "ON_REQUEST" || !price.amount) return "Ціна за запитом";
  const [whole, fraction] = price.amount.split(".");
  const value =
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") +
    (fraction === "00" ? "" : "," + fraction);
  return `${price.mode === "FROM" ? "Від " : ""}${value} ₴${price.unit ? " / " + units[price.unit] : ""}`;
}
