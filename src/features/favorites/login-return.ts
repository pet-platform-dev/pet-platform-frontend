/** Only existing discovery destinations are accepted after authentication. */
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
    url.pathname !== "/favorites" &&
    !/^\/listings\/[0-9a-f-]{36}$/i.test(url.pathname)
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
