import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/entities/user/model";
import { authenticatedRequest } from "@/shared/api/client";
import { runAdminRequest } from "../moderation/cache";
export const roles = z.enum([
  "USER",
  "BREEDER",
  "MODERATOR",
  "ADMIN",
  "SUPER_ADMIN",
]);
export const editableRoles = ["USER", "MODERATOR", "ADMIN"] as const;
export const roleHistorySchema = z.object({
  currentRole: roles,
  updatedAt: z.iso.datetime(),
  entries: z.array(
    z.object({
      operationId: z.uuid(),
      actorId: z.uuid().nullable(),
      targetUserId: z.uuid(),
      previousRole: roles,
      newRole: roles,
      origin: z.enum(["AUTHENTICATED_ADMIN", "LOCAL_OPERATOR"]),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export type RoleHistory = z.infer<typeof roleHistorySchema>;
export async function runRoleRequest<T>(
  client: QueryClient,
  actorId: string,
  work: () => Promise<T>,
) {
  const valid = () =>
    client.getQueryData<User>(["current-user"])?.role === "SUPER_ADMIN";
  if (!valid()) throw new DOMException("Role permission changed", "AbortError");
  const row = await runAdminRequest(client, actorId, work);
  if (!valid()) throw new DOMException("Role permission changed", "AbortError");
  return row;
}
export async function getRoleHistory(id: string, signal?: AbortSignal) {
  z.uuid().parse(id);
  const result = roleHistorySchema.parse(
    await authenticatedRequest(`/admin/users/${id}/role-history`, { signal }),
  );
  if (result.entries.some((entry) => entry.targetUserId !== id))
    throw Error("Invalid role history identity");
  return result;
}
export async function changeRole(
  id: string,
  body: {
    role: (typeof editableRoles)[number];
    expectedRole: string;
    expectedUpdatedAt: string;
    operationId: string;
    currentPassword: string;
  },
) {
  z.uuid().parse(id);
  const result = z
    .object({
      changed: z.boolean(),
      role: roles,
      updatedAt: z.iso.datetime(),
      operationId: z.uuid(),
    })
    .parse(
      await authenticatedRequest(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  if (result.operationId !== body.operationId || result.role !== body.role)
    throw Error("Invalid role mutation identity");
  return result;
}
