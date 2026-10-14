import type { ReportsState } from "./navigation";
// Existing admin privacy boundaries clear this entire namespace, including mutations.
export const reportKeys = {
  conversation: (uid: string, id: string) =>
    ["admin-moderation", uid, "reports", "conversation", id] as const,
  queue: (uid: string, state?: ReportsState) =>
    state
      ? (["admin-moderation", uid, "reports", "queue", state] as const)
      : (["admin-moderation", uid, "reports", "queue"] as const),
  detail: (uid: string, id: string) =>
    ["admin-moderation", uid, "reports", "detail", id] as const,
};
