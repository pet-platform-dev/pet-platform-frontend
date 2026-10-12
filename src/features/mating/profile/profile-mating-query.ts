import { parsePublicMatingReturn } from "../detail/navigation";
export function profileMatingPage(value: string | null) {
  return value && /^[1-9]\d*$/.test(value) && Number(value) <= 100000
    ? Number(value)
    : 1;
}
export function profileMatingHref(ownerId: string, page: number) {
  return parsePublicMatingReturn(
    `/sellers/${ownerId}` + (page > 1 ? `?matingPage=${page}` : ""),
  ).href;
}
export function recoverMatingPage(page: number, pages: number) {
  return Math.max(1, Math.min(page, pages));
}
