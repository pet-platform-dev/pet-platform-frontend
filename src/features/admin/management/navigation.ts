import type { BreederSource } from "./model";
export type ManagementKind = "users" | "breeders";
export type ListState = {
  q: string;
  page: number;
  sort: string;
  source: BreederSource;
  role?: string;
  accountType?: string;
  verificationStatus?: string;
  visibility?: string;
};
const allowed = (value: string | null, values: string[]) =>
  value && values.includes(value) ? value : undefined;
export function parseListState(
  search: URLSearchParams,
  kind: ManagementKind,
): ListState {
  return {
    q: (search.get("q") ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    page:
      /^[1-9]\d*$/.test(search.get("page") ?? "") &&
      Number(search.get("page")) <= 100000
        ? Number(search.get("page"))
        : 1,
    sort:
      allowed(search.get("sort"), [
        "NEWEST",
        "OLDEST",
        "NAME_ASC",
        "NAME_DESC",
      ]) ?? "NEWEST",
    source:
      search.get("source") === "OPERATOR_PREPARED"
        ? "OPERATOR_PREPARED"
        : "OWNER_MANAGED",
    ...(kind === "users"
      ? {
          role: allowed(search.get("role"), [
            "USER",
            "BREEDER",
            "MODERATOR",
            "ADMIN",
            "SUPER_ADMIN",
          ]),
          accountType: allowed(search.get("accountType"), [
            "SELLER",
            "BREEDER",
          ]),
          verificationStatus: allowed(search.get("verificationStatus"), [
            "UNVERIFIED",
            "PENDING",
            "VERIFIED",
            "REJECTED",
          ]),
        }
      : {
          visibility: allowed(search.get("visibility"), ["PUBLIC", "PRIVATE"]),
        }),
  };
}
export function listParams(state: ListState, kind: ManagementKind) {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "sort",
    "page",
    ...(kind === "users"
      ? ["role", "accountType", "verificationStatus"]
      : ["source", "visibility"]),
  ] as (keyof ListState)[]) {
    const value = state[key];
    if (
      value &&
      !(key === "page" && value === 1) &&
      !(key === "sort" && value === "NEWEST") &&
      !(key === "source" && value === "OWNER_MANAGED")
    )
      params.set(key, String(value));
  }
  return params;
}
export const listHref = (kind: ManagementKind, state: ListState) =>
  `/admin/${kind}` +
  (listParams(state, kind).size ? "?" + listParams(state, kind) : "");
export function managementReturn(value: unknown, kind: ManagementKind) {
  if (
    typeof value !== "string" ||
    /[\\\x00-\x20\x7f]/.test(value) ||
    value.length > 4096
  )
    return `/admin/${kind}`;
  try {
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      url.pathname !== `/admin/${kind}` ||
      value.split("?")[0] !== url.pathname ||
      url.hash
    )
      return `/admin/${kind}`;
    return listHref(kind, parseListState(url.searchParams, kind));
  } catch {
    return `/admin/${kind}`;
  }
}
export function managedDetailHref(
  kind: ManagementKind,
  id: string,
  state: ListState,
) {
  return (
    `/admin/${kind}/${id}?` +
    new URLSearchParams({
      returnTo: listHref(kind, state),
      ...(kind === "breeders" ? { source: state.source } : {}),
    })
  );
}
