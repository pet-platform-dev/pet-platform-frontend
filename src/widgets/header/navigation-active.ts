export function navigationActive(
  pathname: string,
  href: string,
  publicBreeder = false,
): boolean {
  return (
    (href === "/breeders" &&
      publicBreeder &&
      /^\/sellers\/[^/]+$/.test(pathname)) ||
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href === "/account" &&
      (pathname === "/profile" || pathname.startsWith("/profile/")))
  );
}
