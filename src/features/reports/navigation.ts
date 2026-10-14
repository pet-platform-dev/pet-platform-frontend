import { reportStatuses, type ReportStatus, type ReportType } from "./model";
import { reportTypes } from "./model";
export const reportsPath = "/admin/moderation/reports";
export type ReportsState = {
  status: ReportStatus;
  type?: ReportType;
  page: number;
};
export function parseReportsState(
  input: Record<string, string | string[] | undefined>,
): ReportsState {
  return {
    status:
      typeof input.status === "string" &&
      reportStatuses.includes(input.status as ReportStatus)
        ? (input.status as ReportStatus)
        : "OPEN",
    type:
      typeof input.type === "string" &&
      reportTypes.includes(input.type as ReportType)
        ? (input.type as ReportType)
        : undefined,
    page:
      typeof input.page === "string" &&
      /^[1-9]\d*$/.test(input.page) &&
      Number(input.page) <= 100000
        ? Number(input.page)
        : 1,
  };
}
export function reportsHref(state: ReportsState) {
  const p = new URLSearchParams();
  if (state.type) p.set("type", state.type);
  if (state.status !== "OPEN") p.set("status", state.status);
  if (state.page > 1) p.set("page", String(state.page));
  return reportsPath + (p.size ? "?" + p : "");
}
export function safeReportsReturn(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\\\x00-\x20\x7f]/.test(value)
  )
    return reportsPath;
  try {
    const u = new URL(value, "https://internal.invalid");
    if (
      u.origin !== "https://internal.invalid" ||
      u.pathname !== reportsPath ||
      u.hash ||
      u.pathname !== value.split("?")[0]
    )
      return reportsPath;
    const input: Record<string, string> = {};
    for (const key of ["status", "type", "page"]) {
      const all = u.searchParams.getAll(key);
      if (all.length > 1) return reportsPath;
      if (all.length) input[key] = all[0];
    }
    return reportsHref(parseReportsState(input));
  } catch {
    return reportsPath;
  }
}
export function reportDetailHref(id: string, returnTo: string) {
  return (
    reportsPath +
    "/" +
    id +
    "?" +
    new URLSearchParams({ returnTo: safeReportsReturn(returnTo) })
  );
}
export function safeReportDetailReturn(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\\\x00-\x20\x7f]/.test(value)
  )
    return null;
  try {
    const u = new URL(value, "https://internal.invalid");
    if (
      u.origin !== "https://internal.invalid" ||
      u.hash ||
      u.pathname !== value.split("?")[0] ||
      !/^\/admin\/moderation\/reports\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        u.pathname,
      )
    )
      return null;
    if (u.searchParams.getAll("returnTo").length > 1) return null;
    return reportDetailHref(
      u.pathname.split("/").at(-1)!,
      safeReportsReturn(u.searchParams.get("returnTo")),
    );
  } catch {
    return null;
  }
}
