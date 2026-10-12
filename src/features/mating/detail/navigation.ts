import {
  matingHref,
  parseMatingUrl,
  type MatingCatalogQuery,
} from "../catalog/query";
import { z } from "zod";
function path(value: string | string[] | undefined) {
  if (
    typeof value !== "string" ||
    value.length > 8192 ||
    /[\s\\#\p{Cc}]/u.test(value) ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return null;
  const url = new URL(value, "https://internal.invalid");
  if (
    url.searchParams.has("returnTo") ||
    [...url.searchParams.keys()].some(
      (key) => url.searchParams.getAll(key).length !== 1,
    )
  )
    return null;
  return url;
}
export function parsePublicMatingReturn(value: string | string[] | undefined) {
  const fallback = { href: "/mating", label: "До оголошень про в’язку" };
  const url = path(value);
  if (!url) return fallback;
  if (url.pathname === "/mating")
    return { ...fallback, href: matingHref(parseMatingUrl(url.searchParams)) };
  const match = url.pathname.match(/^\/(pets|sellers)\/([^/]+)$/);
  if (
    !match ||
    !z.uuid().safeParse(match[2]).success ||
    url.pathname !== String(value).split("?")[0]
  )
    return fallback;
  if (match[1] === "pets")
    return url.search
      ? fallback
      : { href: url.pathname, label: "До профілю тварини" };
  const rawPage = url.searchParams.get("matingPage");
  if (
    rawPage !== null &&
    (!/^[1-9]\d*$/.test(rawPage) || Number(rawPage) > 100000)
  )
    return fallback;
  const page = Number(rawPage ?? "1");
  return {
    href: url.pathname + (page > 1 ? `?matingPage=${page}` : ""),
    label: "До профілю власника",
  };
}
export function safeOwnerMatingReturn(value: string | string[] | undefined) {
  const url = path(value);
  if (!url || url.search || url.pathname !== value) return "/mating/my";
  if (url.pathname === "/pets" || url.pathname === "/profile/breeder/animals")
    return url.pathname;
  const match = url.pathname.match(/^\/pets\/([^/]+)\/edit$/);
  return match && z.uuid().safeParse(match[1]).success
    ? url.pathname
    : "/mating/my";
}
export function ownerMatingReturnLabel(href: string) {
  return href === "/mating/my"
    ? "До моїх оголошень про в’язку"
    : "До моїх тварин";
}
export function matingCreateHref(
  petId: string | string[] | undefined,
  returnTo: string | string[] | undefined,
) {
  const query = new URLSearchParams();
  if (typeof petId === "string" && z.uuid().safeParse(petId).success)
    query.set("petId", petId);
  const context = safeOwnerMatingReturn(returnTo);
  if (context !== "/mating/my") query.set("returnTo", context);
  return "/mating/new" + (query.size ? `?${query}` : "");
}
export function matingEditHref(id: string, returnTo?: string) {
  const context = safeOwnerMatingReturn(returnTo);
  return (
    `/mating/${encodeURIComponent(id)}/edit` +
    (context !== "/mating/my"
      ? `?${new URLSearchParams({ returnTo: context })}`
      : "")
  );
}
export function safeMatingReturn(value: string | string[] | undefined): string {
  return parsePublicMatingReturn(value).href;
}
export function matingDetailHref(
  id: string,
  query: MatingCatalogQuery,
  returnTo?: string,
) {
  return `/mating/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo: returnTo ? safeMatingReturn(returnTo) : matingHref(query) })}`;
}
