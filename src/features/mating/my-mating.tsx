"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  getMyMating,
  type OwnerStatusFilter,
} from "@/entities/mating-listing/api";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import { ListingManagementSkeleton } from "@/features/listing/manage-listing/listing-management-skeleton";
import { MatingCard, MatingEmpty } from "./mating-card";
import { matingKeys } from "./cache";
export function MyMating() {
  const userId = useSession().data!.id;
  const [page, setPage] = useState(1),
    [status, setStatus] = useState<OwnerStatusFilter | undefined>();
  const query = useQuery({
    queryKey: [...matingKeys.mine(userId), status ?? "all", page],
    queryFn: ({ signal }) => getMyMating(page, status, signal),
  });
  return (
    <section className="mating-management">
      <div className="owner-page-heading">
        <div>
          <p className="eyebrow">В’язка</p>
          <h1>Оголошення про в’язку</h1>
          <p className="muted">
            Ваші тварини, чернетки та активний пошук пари.
          </p>
        </div>
        <div className="account-actions">
          <Link className="button primary" href="/mating/new">
            Створити оголошення
          </Link>
          <Link className="button secondary" href="/mating">
            Переглянути в’язку
          </Link>
        </div>
      </div>
      <div className="mating-filter">
        <SelectDropdown
          label="Статус оголошень"
          value={status ?? ""}
          onChange={(value) => {
            setStatus(value ? (value as OwnerStatusFilter) : undefined);
            setPage(1);
          }}
          options={[
            { value: "", label: "Усі" },
            { value: "DRAFT", label: "Чернетка" },
            { value: "ACTIVE", label: "Активне" },
            { value: "PENDING", label: "На модерації" },
            { value: "REJECTED", label: "Відхилено" },
            { value: "HIDDEN", label: "Приховано" },
            { value: "CLOSED", label: "Завершено" },
            { value: "ARCHIVED", label: "Архів" },
          ]}
        />
      </div>
      {query.isPending ? (
        <ListingManagementSkeleton />
      ) : query.isError ? (
        <section className="mating-panel">
          <p role="alert">Не вдалося завантажити ваші оголошення.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </section>
      ) : (
        <>
          {query.data.data.length ? (
            <div className="mating-grid">
              {query.data.data.map((row) => (
                <MatingCard key={row.id} row={row} />
              ))}
            </div>
          ) : status || page > 1 ? (
            <div className="mating-panel">
              <p>На цій сторінці поки немає оголошень.</p>
            </div>
          ) : (
            <MatingEmpty />
          )}
          {(query.data.meta.pages > 1 || page > 1) && (
            <nav
              aria-label="Сторінки моїх оголошень"
              className="mating-pagination"
            >
              <button
                className="button secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Попередня
              </button>
              <span role="status">
                Сторінка {page} із {Math.max(page, query.data.meta.pages)}
              </span>
              <button
                className="button secondary"
                disabled={page >= query.data.meta.pages}
                onClick={() => setPage(page + 1)}
              >
                Наступна
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
