"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { getFavoriteStates } from "./api";
import {
  favoriteBatchKey,
  favoriteLocked,
  favoriteOwnerCurrent,
  favoriteStateKey,
} from "./cache";
const FavoriteContext = createContext<{
  register: (id: string) => () => void;
  error: boolean;
  retry: () => void;
}>({ register: () => () => {}, error: false, retry: () => {} });
function RegisteredFavorites({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const registered = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [ids, setIds] = useState<string[]>([]);
  const register = useCallback((id: string) => {
    const schedule = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () => setIds([...registered.current.keys()].sort()),
        40,
      );
    };
    registered.current.set(id, (registered.current.get(id) ?? 0) + 1);
    schedule();
    return () => {
      const count = (registered.current.get(id) ?? 1) - 1;
      if (count) registered.current.set(id, count);
      else registered.current.delete(id);
      schedule();
    };
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const batch = useQuery({
    queryKey: [
      ...(userId ? favoriteBatchKey(userId) : ["favorite-batch", null]),
      ids,
    ],
    queryFn: userId
      ? ({ signal }) => getFavoriteStates(ids, signal)
      : skipToken,
    enabled: Boolean(userId) && ids.length > 0,
  });
  useEffect(() => {
    if (!userId || !batch.data || !favoriteOwnerCurrent(client, userId)) return;
    for (const [id, value] of Object.entries(batch.data)) {
      if (!favoriteLocked(client, userId, id))
        client.setQueryData(favoriteStateKey(userId, id), value);
    }
  }, [batch.data, batch.dataUpdatedAt, client, userId]);
  return (
    <FavoriteContext
      value={{
        register,
        error: Boolean(userId) && batch.isError,
        retry: () => {
          if (userId && ids.length) void batch.refetch();
        },
      }}
    >
      {children}
    </FavoriteContext>
  );
}
export function FavoriteProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  // Keep the route subtree mounted during session restoration/logout/account changes.
  // Only query keys carry the owner identity; registrations contain public listing IDs.
  return (
    <RegisteredFavorites userId={session.data?.id ?? null}>
      {children}
    </RegisteredFavorites>
  );
}
export function useFavoriteBatch(id: string) {
  const context = useContext(FavoriteContext);
  const { register } = context;
  useEffect(() => register(id), [register, id]);
  return context;
}
