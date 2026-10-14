"use client";
import { RecordPreview } from "./health-records/record-preview";
import { HistoryPreview } from "./history/history-preview";
import { RemindersPreview } from "./reminders/reminders-preview";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { RequireSession } from "@/features/auth/require-session";
import { useSession } from "@/features/auth/session-provider";
import { ApiError } from "@/shared/api/client";
import { getPetCare } from "./api";
import { petCareKeys, petCareHref } from "./model";
import { PetCareHeader } from "./pet-care-header";
import { PetCareOverview } from "./pet-care-overview";
export function PetCareLoading() {
  return (
    <div
      className="pet-care-loading"
      role="status"
      aria-label="Завантажуємо догляд за твариною"
    >
      <div className="pet-care-identity" aria-hidden="true">
        <div className="pet-care-photo pet-care-skeleton" />
        <div className="pet-care-identity-text">
          <div className="pet-care-skeleton pet-care-skeleton-title" />
          <div className="pet-care-skeleton pet-care-skeleton-line" />
          <div className="pet-care-skeleton pet-care-skeleton-line" />
        </div>
      </div>
      <div className="pet-care-grid" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            className={"pet-care-card" + (i === 0 ? " pet-care-upcoming" : "")}
            key={i}
          >
            <div className="pet-care-skeleton pet-care-skeleton-title" />
            <div className="pet-care-skeleton pet-care-skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
export function PetCareDashboard({ id }: { id: string }) {
  const userId = useSession().data!.id;
  const query = useQuery({
    queryKey: petCareKeys.dashboard(userId, id),
    queryFn: ({ signal }) => getPetCare(id, signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  return (
    <main className="catalog-shell pet-care-page">
      <Link className="pet-care-back" href="/pets">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 19-7-7 7-7M5 12h14" />
        </svg>
        До моїх тварин
      </Link>
      {query.isPending ? (
        <PetCareLoading />
      ) : query.isError ? (
        <section className="pet-care-card" role="alert">
          <h1>
            {query.error instanceof ApiError && query.error.status === 404
              ? "Тварину не знайдено або у вас немає доступу."
              : "Не вдалося завантажити дані тварини."}
          </h1>
          {!(query.error instanceof ApiError && query.error.status === 404) && (
            <button
              className="button secondary"
              onClick={() => void query.refetch()}
            >
              Спробувати ще раз
            </button>
          )}
        </section>
      ) : (
        <>
          <PetCareHeader pet={query.data} />
          <p className="pet-care-private-note">
            Особистий простір догляду. Ці розділи доступні лише вам.
          </p>
          <PetCareOverview
            upcoming={<RemindersPreview id={id} compact />}
            reminders={<RemindersPreview id={id} />}
            history={<HistoryPreview id={id} />}
            vaccinations={<RecordPreview id={id} kind="vaccinations" />}
            medications={<RecordPreview id={id} kind="medications" />}
          />
        </>
      )}
    </main>
  );
}
export function PetCarePage({ id }: { id: string }) {
  return (
    <RequireSession returnTo={petCareHref(id)}>
      <PetCareDashboard key={id} id={id} />
    </RequireSession>
  );
}
