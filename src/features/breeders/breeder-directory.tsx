"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  directoryKey,
  getBreederDirectory,
} from "@/entities/breeder/directory";
import { BreederCard } from "./breeder-card";
import { BreederDirectorySkeleton } from "./breeder-directory-skeleton";
import { DirectoryFilters } from "./directory-filters";
import { useDirectoryFilters } from "./use-directory-filters";
import {
  directoryHref,
  hasDirectoryFilters,
  type DirectoryQuery,
} from "@/entities/breeder/directory-query";
export function BreederDirectory({ initial }: { initial: DirectoryQuery }) {
  const filters = useDirectoryFilters(initial);
  const { query } = filters;
  const { page } = query;
  const filtered = hasDirectoryFilters(query);
  const pageHref = (page: number) => directoryHref({ ...query, page });
  const result = useQuery({
    queryKey: directoryKey(query),
    queryFn: ({ signal }) => getBreederDirectory(query, signal),
    staleTime: 0,
    refetchOnMount: "always",
  });
  return (
    <main className="catalog-shell breeder-directory">
      <header className="catalog-intro">
        <p className="eyebrow">З турботою про майбутню дружбу</p>
        <h1>Розплідники</h1>
        <p>Познайомтеся з розплідниками та їхніми тваринами.</p>
      </header>
      <DirectoryFilters filters={filters} />
      {result.isPending ? (
        <BreederDirectorySkeleton />
      ) : result.isError ? (
        <section className="breeder-directory-state" role="alert">
          <p>Не вдалося завантажити розплідники.</p>
          <button
            className="button secondary"
            onClick={() => void result.refetch()}
          >
            Спробувати ще раз
          </button>
        </section>
      ) : (
        <>
          {result.data.data.length ? (
            <section
              className="breeder-directory-grid"
              aria-label="Публічні розплідники"
            >
              {result.data.data.map((breeder) => (
                <BreederCard key={breeder.userId} breeder={breeder} />
              ))}
            </section>
          ) : (
            <section className="breeder-directory-state">
              <h2>
                {result.data.meta.total
                  ? "На цій сторінці немає розплідників"
                  : filtered && result.data.meta.hasPublicBreeders !== false
                    ? "Розплідників за цими параметрами не знайдено"
                    : "Розплідників поки немає"}
              </h2>
              <p>
                {result.data.meta.total
                  ? "Поверніться до першої сторінки каталогу."
                  : filtered && result.data.meta.hasPublicBreeders !== false
                    ? "Спробуйте змінити або скинути фільтри."
                    : "Коли публічні профілі розплідників з’являться на платформі, вони відображатимуться тут."}
              </p>
              {result.data.meta.total > 0 && (
                <Link className="button secondary" href={pageHref(1)}>
                  До першої сторінки
                </Link>
              )}
              {!result.data.meta.total && filtered && (
                <button className="button secondary" onClick={filters.reset}>
                  Скинути фільтри
                </button>
              )}
            </section>
          )}
          {result.data.meta.pages > 1 && (
            <nav className="page-pagination" aria-label="Сторінки розплідників">
              {page > 1 ? (
                <Link className="button secondary" href={pageHref(page - 1)}>
                  Назад
                </Link>
              ) : (
                <span className="button secondary" aria-disabled="true">
                  Назад
                </span>
              )}
              <span aria-live="polite">
                {page} / {result.data.meta.pages}
              </span>
              {page < result.data.meta.pages ? (
                <Link className="button secondary" href={pageHref(page + 1)}>
                  Далі
                </Link>
              ) : (
                <span className="button secondary" aria-disabled="true">
                  Далі
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
