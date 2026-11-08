"use client";
import { createContext, useContext, useRef } from "react";
import {
  useQuery,
  useMutation,
  useIsMutating,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { RequireSession } from "@/features/auth/require-session";
import { ApiError, currentSessionGeneration } from "@/shared/api/client";
import type { User } from "@/entities/user/model";
import { usePathname } from "next/navigation";
const Scope = createContext<{ userId: string; generation: number } | null>(
  null,
);
export const workspaceKey = (
  userId: string,
  generation: number,
  ...parts: unknown[]
) => ["service-workspace", userId, generation, ...parts] as const;
export function currentWorkspace(
  client: QueryClient,
  scope: { userId: string; generation: number },
) {
  return (
    currentSessionGeneration() === scope.generation &&
    client.getQueryData<User | null>(["current-user"])?.id === scope.userId
  );
}
export function WorkspaceSession({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireSession returnTo={pathname}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </RequireSession>
  );
}
function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  if (!data) return null;
  const generation = currentSessionGeneration();
  return (
    <Scope.Provider
      key={`${data.id}:${generation}`}
      value={{ userId: data.id, generation }}
    >
      {children}
    </Scope.Provider>
  );
}
export function useWorkspaceScope() {
  const scope = useContext(Scope);
  if (!scope) throw Error("Authenticated workspace required");
  return scope;
}
export function useWorkspaceBusy(providerId?: string) {
  const scope = useWorkspaceScope();
  return (
    useIsMutating({
      mutationKey: [
        "service-workspace",
        scope.userId,
        scope.generation,
        ...(providerId ? [providerId] : []),
      ],
    }) > 0
  );
}
export function useWorkspaceQuery<T>(
  parts: unknown[],
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const scope = useWorkspaceScope(),
    client = useQueryClient();
  return useQuery({
    queryKey: workspaceKey(scope.userId, scope.generation, ...parts),
    queryFn: async ({ signal }) => {
      if (!currentWorkspace(client, scope))
        throw new DOMException("Session changed", "AbortError");
      const result = await fetcher(signal);
      signal.throwIfAborted();
      if (!currentWorkspace(client, scope))
        throw new DOMException("Session changed", "AbortError");
      return result;
    },
    retry: false,
    staleTime: 15000,
  });
}
export async function invalidateWorkspace(
  client: QueryClient,
  scope: { userId: string; generation: number },
  providerId?: string,
) {
  if (!currentWorkspace(client, scope)) return false;
  await client.cancelQueries({
    queryKey: workspaceKey(scope.userId, scope.generation),
  });
  if (!currentWorkspace(client, scope)) return false;
  await client.invalidateQueries({
    queryKey: workspaceKey(scope.userId, scope.generation),
  });
  // Private drafts never enter public query caches. SSR is no-store.
  await Promise.all(
    ["service-offers", "service-providers", "service-provider"].map((k) =>
      client.invalidateQueries({
        queryKey:
          providerId && k === "service-provider" ? [k, providerId] : [k],
      }),
    ),
  );
  return currentWorkspace(client, scope);
}
export function useWorkspaceAction<T, V>(
  action: (value: V) => Promise<T>,
  providerId?: string,
  invalidate = true,
) {
  const scope = useWorkspaceScope(),
    client = useQueryClient(),
    running = useRef(false);
  return useMutation({
    mutationKey: [
      "service-workspace",
      scope.userId,
      scope.generation,
      providerId ?? "create",
    ],
    retry: false,
    mutationFn: async (value: V) => {
      if (running.current)
        throw Error("Дочекайтеся завершення попередньої дії");
      running.current = true;
      try {
        if (!currentWorkspace(client, scope))
          throw new DOMException("Session changed", "AbortError");
        const result = await action(value);
        if (!currentWorkspace(client, scope))
          throw new DOMException("Session changed", "AbortError");
        return result;
      } finally {
        running.current = false;
      }
    },
    onSuccess: () =>
      (invalidate
        ? invalidateWorkspace(client, scope, providerId)
        : Promise.resolve(currentWorkspace(client, scope))
      ).then((current) => {
        if (!current) throw new DOMException("Session changed", "AbortError");
      }),
  });
}
export function useWorkspaceRefresh<T>(
  parts: unknown[],
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const scope = useWorkspaceScope(),
    client = useQueryClient();
  return useWorkspaceAction(
    () =>
      client.fetchQuery({
        queryKey: workspaceKey(scope.userId, scope.generation, ...parts),
        staleTime: 0,
        retry: false,
        queryFn: async ({ signal }) => {
          if (!currentWorkspace(client, scope))
            throw new DOMException("Session changed", "AbortError");
          const result = await fetcher(signal);
          signal.throwIfAborted();
          if (!currentWorkspace(client, scope))
            throw new DOMException("Session changed", "AbortError");
          return result;
        },
      }),
    String(parts[0]),
    false,
  );
}
export function workspaceError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409)
      return "Дані змінилися або дія недоступна в поточному стані. Оновіть дані й перевірте їх перед повторною дією. Незбережений текст залишено у формі.";
    if (error.status === 404)
      return "Профіль або послуга недоступні. Перевірте, чи маєте ви право керування.";
    if (error.status === 403)
      return "Дію не дозволено. Перевірте підтвердження пошти та оновіть сторінку для повторної перевірки безпеки.";
    if (error.status === 0)
      return "Зв’язок перервано. Дані могли зберегтися: спочатку перевірте список або оновіть дані, щоб не створити дублікат.";
    return error.message;
  }
  return error instanceof Error && error.name !== "AbortError"
    ? error.message
    : "Сесія змінилася. Увійдіть знову.";
}
