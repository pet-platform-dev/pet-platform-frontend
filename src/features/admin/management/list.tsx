"use client";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "../moderation/cache";
import { CatalogPagination } from "@/widgets/listings-catalog/catalog-pagination";
import {
  parseListState,
  listHref,
  type ListState,
  type ManagementKind,
} from "./navigation";
import { listUsers, listBreeders, managementKey } from "./api";
import { ManagementFilters } from "./filters";
import { ManagementListCards } from "./list-cards";
export function ManagementList({ kind }: { kind: ManagementKind }) {
  const search = useSearchParams(),
    router = useRouter(),
    user = useSession().data,
    client = useQueryClient();
  const state = parseListState(new URLSearchParams(search.toString()), kind),
    href = listHref(kind, state);
  const change = useCallback(
    (changes: Partial<ListState>) => {
      const current = parseListState(
        new URLSearchParams(search.toString()),
        kind,
      );
      router.push(listHref(kind, { ...current, ...changes }), {
        scroll: false,
      });
    },
    [search, kind, router],
  );
  const query = useQuery({
    queryKey: managementKey(user?.id ?? "", kind, state),
    queryFn: ({ signal }) =>
      runAdminRequest<
        | Awaited<ReturnType<typeof listUsers>>
        | Awaited<ReturnType<typeof listBreeders>>
      >(client, user!.id, () =>
        kind === "users"
          ? listUsers(state, signal)
          : listBreeders(state, signal),
      ),
    enabled: user?.role === "ADMIN",
    staleTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (
      query.data &&
      !query.isFetching &&
      !query.isError &&
      state.page > Math.max(1, query.data.meta.pages)
    )
      change({ page: Math.max(1, query.data.meta.pages) });
  }, [query.data, query.isFetching, query.isError, state.page, change]);
  if (!user || user.role !== "ADMIN") return null;
  return (
    <section className="admin-management" aria-labelledby="admin-list-title">
      <header>
        <h1 id="admin-list-title">
          {kind === "users" ? "Користувачі" : "Розплідники"}
        </h1>
        <p className="muted">
          {kind === "users"
            ? "Облікові дані доступні лише адміністратору. Цей розділ лише для перегляду."
            : "Профілі власників і приватні операторські чернетки переглядаються окремо."}
        </p>
        {kind === "breeders" && (
          <Link
            className="button secondary"
            href={
              "/admin/breeders/new?" + new URLSearchParams({ returnTo: href })
            }
            prefetch={false}
          >
            Створити приватну чернетку
          </Link>
        )}
      </header>
      <ManagementFilters
        key={href}
        kind={kind}
        state={state}
        onChange={change}
      />
      {query.isPending || query.isFetching ? (
        <div className="status-panel" role="status">
          Завантажуємо записи…
        </div>
      ) : query.isError ? (
        <div className="status-panel">
          <p role="alert">Не вдалося завантажити записи.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          <p role="status">Знайдено: {query.data.meta.total}</p>
          {query.data.data.length ? (
            <ManagementListCards
              rows={query.data.data}
              kind={kind}
              state={state}
            />
          ) : (
            <p className="status-panel">За цими умовами записів немає.</p>
          )}
          <CatalogPagination
            page={query.data.meta.page}
            pages={query.data.meta.pages}
            sort="newest"
            hrefForPage={(page) => listHref(kind, { ...state, page })}
            label="Сторінки адміністративного списку"
          />
        </>
      )}
    </section>
  );
}
