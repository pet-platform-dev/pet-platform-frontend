import {
  contentTypes,
  queueStatuses,
  type ContentType,
  type QueueStatus,
} from "./model";
import { safeReportDetailReturn } from "@/features/reports/navigation";
export type QueueState = {
  type?: ContentType;
  status: QueueStatus;
  page: number;
};
export const typeSegments = {
  LISTING: "listings",
  MATING_LISTING: "mating-listings",
  REVIEW: "reviews",
} as const;
export function contentTypeFromSegment(value: string): ContentType | null {
  return (
    (Object.keys(typeSegments) as ContentType[]).find(
      (type) => typeSegments[type] === value,
    ) ?? null
  );
}
export function parseQueueState(
  input: Record<string, string | string[] | undefined>,
): QueueState {
  return {
    type:
      typeof input.type === "string" &&
      contentTypes.includes(input.type as ContentType)
        ? (input.type as ContentType)
        : undefined,
    status:
      typeof input.status === "string" &&
      queueStatuses.includes(input.status as QueueStatus)
        ? (input.status as QueueStatus)
        : "PENDING",
    page:
      typeof input.page === "string" &&
      /^[1-9]\d*$/.test(input.page) &&
      Number(input.page) <= 100000
        ? Number(input.page)
        : 1,
  };
}
export function queueHref(state: QueueState) {
  const params = new URLSearchParams();
  if (state.type) params.set("type", state.type);
  if (state.status !== "PENDING") params.set("status", state.status);
  if (state.page > 1) params.set("page", String(state.page));
  return "/admin/moderation" + (params.size ? "?" + params : "");
}
export function safeQueueReturn(value: unknown) {
  const reportReturn = safeReportDetailReturn(value);
  if (reportReturn) return reportReturn;
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\\\x00-\x20\x7f]/.test(value) ||
    !value.startsWith("/admin/moderation")
  )
    return "/admin/moderation";
  try {
    const url = new URL(value, "https://internal.invalid");
    if (
      url.origin !== "https://internal.invalid" ||
      url.pathname !== "/admin/moderation" ||
      url.hash ||
      url.pathname !== value.split("?")[0]
    )
      return "/admin/moderation";
    const input: Record<string, string | string[]> = {};
    for (const key of ["type", "status", "page"]) {
      const all = url.searchParams.getAll(key);
      if (all.length > 1) return "/admin/moderation";
      if (all.length) input[key] = all[0];
    }
    return queueHref(parseQueueState(input));
  } catch {
    return "/admin/moderation";
  }
}
export function detailHref(type: ContentType, id: string, returnTo: string) {
  return (
    "/admin/moderation/" +
    typeSegments[type] +
    "/" +
    id +
    "?" +
    new URLSearchParams({ returnTo: safeQueueReturn(returnTo) })
  );
}
export const safeAdminPath = (path: string) =>
  path === "/admin/moderation/reports" ||
  /^\/admin\/moderation\/reports\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    path,
  ) ||
  path === "/admin/moderation" ||
  /^\/admin\/moderation\/(?:listings|mating-listings|reviews)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    path,
  );
