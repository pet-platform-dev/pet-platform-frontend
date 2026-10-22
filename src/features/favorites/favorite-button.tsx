"use client";
import { useId, useState } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  skipToken,
} from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  notifySessionChange,
  useSession,
} from "@/features/auth/session-provider";
import { useFavoriteBatch } from "./favorite-provider";
import { toggleFavorite } from "./api";
import {
  favoriteBatchKey,
  favoriteOwnerCurrent,
  favoritePagesKey,
  favoriteStateKey,
  lockFavorite,
  optimisticFavorite,
  rollbackFavorite,
  unlockFavorite,
} from "./cache";
import { favoriteLoginHref } from "./login-return";
import { useHydrated } from "@/shared/hooks/use-hydrated";
export function FavoriteButton({
  listingId,
  returnTo,
  detail = false,
}: {
  listingId: string;
  returnTo?: string;
  detail?: boolean;
}) {
  const hydrated = useHydrated();
  const client = useQueryClient(),
    session = useSession(),
    router = useRouter();
  const pathname = usePathname();
  const userId = session.data?.id ?? "";
  const batch = useFavoriteBatch(listingId);
  const state = useQuery<boolean>({
    queryKey: favoriteStateKey(userId, listingId),
    queryFn: skipToken,
    enabled: false,
  });
  const scope = userId + ":" + listingId;
  const [notice, setNotice] = useState({ scope, message: "" });
  const outcomes = useMutationState({
    filters: {
      mutationKey: ["favorite-toggle", userId, listingId],
      exact: true,
    },
    select: (item) => item.state.status,
  });
  const sharedError =
    outcomes.at(-1) === "error"
      ? "Не вдалося змінити обране. Спробуйте ще раз."
      : "";
  const error = hydrated
    ? (notice.scope === scope ? notice.message : "") || sharedError
    : "";
  const setError = (message: string) => setNotice({ scope, message });
  const errorId = useId();
  const mutationKey = ["favorite-toggle", userId, listingId];
  const busy =
    useMutationState({
      filters: { mutationKey, exact: true, status: "pending" },
      select: () => true,
    }).length > 0;
  const mutation = useMutation({
    mutationKey,
    mutationFn: (active: boolean) => {
      if (!favoriteOwnerCurrent(client, userId))
        throw new DOMException("Session changed", "AbortError");
      return toggleFavorite(listingId, active);
    },
    onMutate: async (active) => {
      await Promise.all([
        client.cancelQueries({ queryKey: favoriteBatchKey(userId) }),
        client.cancelQueries({ queryKey: favoritePagesKey(userId) }),
      ]);
      return optimisticFavorite(client, userId, listingId, active);
    },
    onError: (_error, _active, snapshot) => {
      if (!favoriteOwnerCurrent(client, userId)) return;
      if (snapshot) rollbackFavorite(client, userId, listingId, snapshot);
      setError("Не вдалося змінити обране. Спробуйте ще раз.");
    },
    onSuccess: (result) => {
      if (!favoriteOwnerCurrent(client, userId)) return;
      client.setQueryData(
        favoriteStateKey(userId, listingId),
        result.isFavorite,
      );
      notifySessionChange("favorites", userId);
    },
    onSettled: async () => {
      unlockFavorite(client, userId, listingId);
      if (favoriteOwnerCurrent(client, userId))
        await Promise.all([
          client.invalidateQueries({ queryKey: favoritePagesKey(userId) }),
          client.invalidateQueries({ queryKey: favoriteBatchKey(userId) }),
        ]);
    },
  });
  const active = hydrated && state.data === true;
  const label = active ? "Видалити з обраного" : "Додати в обране";
  return (
    <div
      className={
        detail ? "favorite-action favorite-action-detail" : "favorite-action"
      }
    >
      <button
        type="button"
        data-favorite-id={listingId}
        className={`favorite-button${active ? " is-favorite" : ""}`}
        aria-label={label}
        title={label}
        aria-pressed={active}
        aria-busy={
          hydrated &&
          (busy ||
            (Boolean(userId) && state.data === undefined && !batch.error))
        }
        aria-describedby={error ? errorId : undefined}
        aria-disabled={hydrated && busy}
        disabled={
          !hydrated ||
          session.isPending ||
          (Boolean(userId) && state.data === undefined && !batch.error)
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!hydrated || busy) return;
          setError("");
          if (!userId) {
            router.push(
              favoriteLoginHref(returnTo ?? pathname + window.location.search),
            );
            return;
          }
          if (batch.error && state.data === undefined) {
            batch.retry();
            setError("Не вдалося перевірити обране. Повторюємо запит.");
            return;
          }
          if (!lockFavorite(client, userId, listingId)) return;
          mutation.mutate(!active);
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
        {detail && <span>{active ? "В обраному" : "Зберегти в обране"}</span>}
      </button>
      {error && (
        <p id={errorId} className="favorite-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
