import { authenticatedRequest } from "@/shared/api/client";
import {
  reportInputSchema,
  reportCreatedSchema,
  reportsQueueSchema,
  reportDetailSchema,
  reportRecordSchema,
  reportDecisionSchema,
  type ReportType,
  type ReportReason,
} from "./model";
import type { ReportsState } from "./navigation";
export async function createReport(
  targetType: ReportType,
  targetId: string,
  reason: ReportReason,
  details: string,
) {
  return reportCreatedSchema.parse(
    await authenticatedRequest<unknown>("/reports", {
      method: "POST",
      body: JSON.stringify(
        reportInputSchema.parse({ targetType, targetId, reason, details }),
      ),
    }),
  );
}
export async function getReports(state: ReportsState, signal?: AbortSignal) {
  const p = new URLSearchParams({
    status: state.status,
    page: String(state.page),
    limit: "24",
  });
  if (state.type) p.set("type", state.type);
  return reportsQueueSchema.parse(
    await authenticatedRequest<unknown>(
      "/admin/reports?" + p,
      { signal },
      true,
    ),
  );
}
export async function getReport(id: string, signal?: AbortSignal) {
  const result = reportDetailSchema.parse(
    await authenticatedRequest<unknown>("/admin/reports/" + id, { signal }),
  );
  if (result.id !== id) throw Error("Invalid report detail");
  return result;
}
export async function decideReport(
  id: string,
  action: "resolve" | "dismiss",
  expectedUpdatedAt: string,
  reason: string,
) {
  return reportRecordSchema.parse(
    await authenticatedRequest<unknown>("/admin/reports/" + id + "/" + action, {
      method: "POST",
      body: JSON.stringify(
        reportDecisionSchema.parse({ expectedUpdatedAt, reason }),
      ),
    }),
  );
}
