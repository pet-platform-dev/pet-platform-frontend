export const catalogSorts = ["newest", "oldest"] as const;
export type CatalogSort = (typeof catalogSorts)[number];
export type CatalogQuery = { page: number; limit: 24; sort: CatalogSort };
export function catalogQuery(
  params: Record<string, string | string[] | undefined>,
): CatalogQuery {
  const value = params.page;
  const page =
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number(value) <= 100000
      ? Number(value)
      : 1;
  return {
    page,
    limit: 24,
    sort: params.sort === "oldest" ? "oldest" : "newest",
  };
}
export function catalogHref(page: number, sort: CatalogSort): string {
  const safePage =
    Number.isInteger(page) && page >= 1 && page <= 100000 ? page : 1;
  return `/listings?${new URLSearchParams({ page: String(safePage), sort })}`;
}
export function catalogPageNumbers(page: number, pages: number): number[] {
  if (pages < 1) return [];
  const current = Math.min(Math.max(1, page), pages);
  const start = Math.max(1, Math.min(current - 2, pages - 4));
  return Array.from(
    { length: Math.min(5, pages) },
    (_, index) => start + index,
  );
}
