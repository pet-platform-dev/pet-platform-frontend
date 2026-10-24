import { authenticatedRequest } from "@/shared/api/client";
import { dashboardSchema } from "./model";
export const dashboardKey = (userId: string) =>
  ["admin-dashboard", userId] as const;
export async function getDashboard(signal?: AbortSignal) {
  return dashboardSchema.parse(
    await authenticatedRequest<unknown>("/admin/dashboard", { signal }),
  );
}
