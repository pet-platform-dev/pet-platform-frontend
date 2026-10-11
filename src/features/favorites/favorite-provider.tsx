"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
function OwnerFavorites({
  userId,
  children,
}: {
  userId: string;
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
    queryKey: [...favoriteBatchKey(userId), ids],
    queryFn: ({ signal }) => getFavoriteStates(ids, signal),
    enabled: ids.length > 0,
  });
  useEffect(() => {
    if (!batch.data || !favoriteOwnerCurrent(client, userId)) return;
    for (const [id, value] of Object.entries(batch.data)) {
      if (!favoriteLocked(client, userId, id))
        client.setQueryData(favoriteStateKey(userId, id), value);
    }
  }, [batch.data, batch.dataUpdatedAt, client, userId]);
  return (
    <FavoriteContext
      value={{
        register,
        error: batch.isError,
        retry: () => {
          void batch.refetch();
        },
      }}
    >
      {children}
    </FavoriteContext>
  );
}
export function FavoriteProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  return session.data ? (
    <OwnerFavorites key={session.data.id} userId={session.data.id}>
      {children}
    </OwnerFavorites>
  ) : (
    children
  );
}
export function useFavoriteBatch(id: string) {
  const context = useContext(FavoriteContext);
  const { register } = context;
  useEffect(() => register(id), [register, id]);
  return context;
}
