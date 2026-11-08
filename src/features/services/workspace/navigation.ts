export function isWorkspacePath(path: string) {
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(
    `^/my-services(?:/new|/${id}(?:/edit|/offers/new|/offers/${id}/edit)?)?$`,
    "i",
  ).test(path);
}
