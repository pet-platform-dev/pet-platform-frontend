export function navigationActive(pathname: string, href: string): boolean {
  return (
    pathname === href ||
    pathname.startsWith(href + "/") ||
    (href === "/account" &&
      (pathname === "/profile" || pathname.startsWith("/profile/")))
  );
}
