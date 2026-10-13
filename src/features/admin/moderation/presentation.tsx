import Link from "next/link";
import { statusLabels, type ModerationDetail } from "./model";
export const moderationDate = (value: string) =>
  new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
export function ModerationBadge({
  status,
}: {
  status: ModerationDetail["moderationStatus"];
}) {
  return (
    <span
      className={`review-status review-status-${status === "NOT_SUBMITTED" ? "pending" : status.toLowerCase()}`}
    >
      {statusLabels[status]}
    </span>
  );
}
export function ModerationIdentity({
  person,
  label,
}: {
  person: { id: string; displayName: string };
  label: string;
}) {
  return (
    <section className="admin-panel">
      <h2>{label}</h2>
      <p>{person.displayName}</p>
      <Link
        className="button secondary"
        href={"/sellers/" + person.id}
        prefetch={false}
      >
        Публічний профіль
      </Link>
    </section>
  );
}
export function ModerationSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <section
      aria-label={
        detail ? "Завантажуємо матеріал" : "Завантажуємо чергу модерації"
      }
      role="status"
      className={detail ? "admin-detail-grid" : "admin-queue-grid"}
    >
      {Array.from({ length: detail ? 2 : 6 }, (_, i) => (
        <div className="admin-panel admin-skeleton" key={i} aria-hidden="true">
          <div />
          <div />
          <div />
          <div />
        </div>
      ))}
    </section>
  );
}
