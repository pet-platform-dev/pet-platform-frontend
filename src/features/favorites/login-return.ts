import { safeAdminPath } from "@/features/admin/moderation/navigation";
/** Only existing discovery/management destinations are accepted after authentication. */
export function favoriteLoginReturn(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\\\x00-\x20\x7f]/.test(value)
  )
    return "/account";
  let url: URL;
  try {
    url = new URL(value, "https://internal.invalid");
  } catch {
    return "/account";
  }
  if (
    url.origin !== "https://internal.invalid" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    url.hash
  )
    return "/account";
  if (
    url.pathname !== "/listings" &&
    !safeAdminPath(url.pathname) &&
    url.pathname !== "/favorites" &&
    url.pathname !== "/messages" &&
    !/^\/pets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/care(?:\/(?:reminders|history|vaccinations|medications))?$/i.test(
      url.pathname,
    ) &&
    !/^\/messages\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      url.pathname,
    ) &&
    url.pathname !== "/mating/new" &&
    url.pathname !== "/mating/my" &&
    !/^\/mating\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/edit)?$/i.test(
      url.pathname,
    ) &&
    !/^\/listings\/[0-9a-f-]{36}$/i.test(url.pathname) &&
    !/^\/sellers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      url.pathname,
    )
  )
    return "/account";
  if (url.pathname !== value.split("?")[0]) return "/account";
  return value;
}
export function favoriteLoginHref(value: unknown): string {
  const target = favoriteLoginReturn(value);
  return (
    "/login?" +
    new URLSearchParams({
      returnTo: target === "/account" ? "/listings" : target,
    })
  );
}
