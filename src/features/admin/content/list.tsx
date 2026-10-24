"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { hasAdminAccess } from "@/entities/user/permissions";
import { runAdminRequest } from "../moderation/cache";
import { contentKey, getContentList, contentHref } from "./api";
import { contentParams } from "./navigation";
import { ContentFilters } from "./filters";
import { statusLabels, ownerName, kindLabels } from "./model";
export function ContentList({ pets = false }: { pets?: boolean }) {
  const actor = useSession().data,
    client = useQueryClient(),
    search = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const params = contentParams(new URLSearchParams(search.toString()), pets);
  const query = useQuery({
    queryKey: contentKey(
      actor?.id ?? "",
      pets ? "pets" : "listings",
      params.toString(),
    ),
    queryFn: ({ signal }) =>
      runAdminRequest(client, actor!.id, () =>
        getContentList(params, pets, signal),
      ),
    enabled: hasAdminAccess(actor?.role),
    retry: false,
  });
  if (!hasAdminAccess(actor?.role)) return null;
  function change(changes: Record<string, string>, page = false) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!page) p.set("page", "1");
    router.replace(`${path}?${p}`, { scroll: false });
  }
  return (
    <section className="admin-management">
      <div className="account-actions">
        <h1>{pets ? "Тварини" : "Оголошення"}</h1>
        {!pets && (
          <Link className="button" href="/admin/listings/new">
            Підготувати чернетку
          </Link>
        )}
      </div>
      <ContentFilters
        key={pets ? "pets" : params.get("source")}
        params={params}
        pets={pets}
        onChange={change}
      />
      {query.isPending ? (
        <p role="status">Завантажуємо…</p>
      ) : query.isError ? (
        <div>
          <p role="alert">Не вдалося завантажити дані.</p>
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
          {!query.data.data.length && (
            <p className="status-panel">За цими умовами нічого не знайдено.</p>
          )}
          <div className="admin-management-grid">
            {query.data.data.map((row) => (
              <article
                key={row.id}
                className="dashboard-card admin-content-card"
              >
                {"source" in row ? (
                  <>
                    <h2>
                      <Link href={contentHref(row.id, row.source)}>
                        {row.title}
                      </Link>
                    </h2>
                    <p>
                      {kindLabels[row.type]} ·{" "}
                      {statusLabels[row.status] ?? row.status}
                    </p>
                    {row.source === "OPERATOR_DRAFT" ? (
                      <p>Приватна підготовка · не опубліковано</p>
                    ) : (
                      <>
                        <p>{ownerName(row.owner)}</p>
                        <p>Модерація: {statusLabels[row.moderationStatus]}</p>
                      </>
                    )}
                    {row.publicPath && (
                      <Link href={row.publicPath}>Публічне оголошення</Link>
                    )}
                  </>
                ) : (
                  <>
                    <h2>
                      <Link href={`/admin/pets/${row.id}`}>
                        {row.name || "Без імені"}
                      </Link>
                    </h2>
                    <p>
                      {row.species.name} ·{" "}
                      {row.breed?.nameUk ??
                        row.breed?.name ??
                        "Породу не вказано"}
                    </p>
                    <p>{ownerName(row.owner)}</p>
                  </>
                )}
                <p className="muted">
                  {new Intl.DateTimeFormat("uk-UA", {
                    dateStyle: "medium",
                  }).format(new Date(row.createdAt))}
                </p>
              </article>
            ))}
          </div>
          <nav className="account-actions" aria-label="Сторінки результатів">
            <button
              className="button secondary"
              disabled={query.data.meta.page <= 1}
              onClick={() =>
                change({ page: String(query.data!.meta.page - 1) }, true)
              }
            >
              Попередня
            </button>
            <span>
              {query.data.meta.page} / {Math.max(1, query.data.meta.pages)}
            </span>
            <button
              className="button secondary"
              disabled={query.data.meta.page >= query.data.meta.pages}
              onClick={() =>
                change({ page: String(query.data!.meta.page + 1) }, true)
              }
            >
              Наступна
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
