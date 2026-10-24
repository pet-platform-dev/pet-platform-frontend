"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import { runAdminRequest } from "../moderation/cache";
import { dashboardKey, getDashboard } from "./api";
import { DashboardCards } from "./cards";

export function AdminDashboard() {
  const session = useSession(),
    client = useQueryClient(),
    user = session.data;
  const query = useQuery({
    queryKey: dashboardKey(user?.id ?? ""),
    queryFn: ({ signal }) =>
      runAdminRequest(client, user!.id, () => getDashboard(signal)),
    enabled: user?.role === "ADMIN",
    staleTime: 15000,
    refetchOnMount: "always",
  });
  if (session.isPending || !user || user.role !== "ADMIN") return null;
  return (
    <section
      className="admin-dashboard"
      aria-labelledby="admin-dashboard-title"
    >
      <header>
        <p className="eyebrow">Адміністрування</p>
        <h1 id="admin-dashboard-title">Огляд платформи</h1>
        <p className="muted">
          Поточні загальні показники. Особисті дані та приватний вміст тут не
          відображаються.
        </p>
      </header>
      {query.isPending || query.isFetching ? (
        <div
          role="status"
          aria-label="Завантажуємо показники"
          className="admin-metrics"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="dashboard-card admin-metric-skeleton"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : query.isError ? (
        <div className="status-panel">
          <p role="alert">Не вдалося завантажити показники.</p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Спробувати ще раз
          </button>
        </div>
      ) : (
        <>
          <DashboardCards data={query.data} />
          <p className="muted">
            Знімок даних:{" "}
            <time dateTime={query.data.asOf}>
              {new Intl.DateTimeFormat("uk-UA", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Europe/Kyiv",
              }).format(new Date(query.data.asOf))}{" "}
              (Київ)
            </time>
          </p>
        </>
      )}
    </section>
  );
}
