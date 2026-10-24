import type { ContentSource } from "./model";
export function contentParams(input: URLSearchParams, pets: boolean) {
  const p = new URLSearchParams();
  const keys = pets
    ? ["q", "sort", "speciesId", "breedId", "page", "limit"]
    : [
        "q",
        "sort",
        "speciesId",
        "breedId",
        "page",
        "limit",
        "source",
        "type",
        "locationId",
        "status",
        "moderationStatus",
        "ownerType",
        "createdFrom",
        "createdTo",
      ];
  for (const key of keys) {
    const value = input.get(key);
    if (value) p.set(key, value);
  }
  if (!/^[1-9]\d{0,4}$/.test(p.get("page") ?? "")) p.set("page", "1");
  if (!["12", "24", "48"].includes(p.get("limit") ?? "")) p.set("limit", "24");
  if (
    !["NEWEST", "OLDEST", "TITLE_ASC", "TITLE_DESC"].includes(
      p.get("sort") ?? "",
    )
  )
    p.set("sort", "NEWEST");
  if (
    !pets &&
    !["LISTING", "MATING", "OPERATOR_DRAFT"].includes(p.get("source") ?? "")
  )
    p.set("source", "LISTING");
  return p;
}
export function readSource(value: string | null): ContentSource {
  return value === "MATING" || value === "OPERATOR_DRAFT" ? value : "LISTING";
}
