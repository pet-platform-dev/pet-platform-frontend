import { z } from "zod";
import { authenticatedRequest, ApiError } from "@/shared/api/client";
import { typeSegments, type QueueState } from "./navigation";
import {
  queueEnvelopeSchema,
  detailSchema,
  advertisementResultSchema,
  reviewResultSchema,
  decisionSchema,
  reasonDecisionSchema,
  type ContentType,
  type ModerationAction,
  type ModerationResult,
} from "./model";
const base = "/admin/moderation";
function resource(type: ContentType, id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new ApiError(400, "Некоректний ідентифікатор");
  return base + "/" + typeSegments[type] + "/" + id;
}
export async function getModerationQueue(
  state: QueueState,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(state.page),
    limit: "24",
    status: state.status,
  });
  if (state.type) params.set("type", state.type);
  return queueEnvelopeSchema.parse(
    await authenticatedRequest<unknown>(
      base + "/queue?" + params,
      { signal },
      true,
    ),
  );
}
export async function getModerationDetail(
  type: ContentType,
  id: string,
  signal?: AbortSignal,
) {
  const data = detailSchema.parse(
    await authenticatedRequest<unknown>(resource(type, id), { signal }),
  );
  if (data.type !== type || data.id !== id)
    throw new Error("Invalid moderation detail");
  return data;
}
export async function moderateContent(
  type: ContentType,
  id: string,
  action: ModerationAction,
  expectedUpdatedAt: string,
  reason?: string,
): Promise<ModerationResult> {
  const body =
    action === "approve"
      ? decisionSchema.parse({ expectedUpdatedAt })
      : reasonDecisionSchema.parse({ expectedUpdatedAt, reason });
  const result = await authenticatedRequest<unknown>(
    resource(type, id) + "/" + action,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (type === "REVIEW") return { type, ...reviewResultSchema.parse(result) };
  const data = advertisementResultSchema.parse(result);
  return type === "LISTING" ? { type, ...data } : { type, ...data };
}
