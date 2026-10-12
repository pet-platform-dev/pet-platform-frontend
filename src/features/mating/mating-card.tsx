import Link from "next/link";
import type { OwnMating } from "@/entities/mating-listing/model";
import {
  canEdit,
  statusLabels,
  feeLabel,
} from "@/entities/mating-listing/model";
import {
  listingDate,
  listingLocation,
} from "@/entities/listing/model/presentation";
import { MatingPetSummary } from "./pet-selection";
export function MatingCard({ row }: { row: OwnMating }) {
  return (
    <article className="mating-panel mating-card">
      <span className={`mating-status ${row.status.toLowerCase()}`}>
        {statusLabels[row.status]}
      </span>
      <MatingPetSummary pet={row.pet} />
      <p className="muted">{listingLocation(row.location)}</p>
      <p className="mating-price">{feeLabel(row.fee)}</p>
      <p className="muted mating-date">
        Оновлено:{" "}
        <time dateTime={row.updatedAt}>{listingDate(row.updatedAt)}</time>
      </p>
      <Link className="button secondary" href={`/mating/${row.id}/edit`}>
        {canEdit(row.status) ? "Редагувати" : "Переглянути"}
      </Link>
    </article>
  );
}
export function MatingEmpty() {
  return (
    <section className="mating-panel mating-empty">
      <h2>У вас ще немає оголошень про в’язку</h2>
      <p className="muted">
        Створіть оголошення для своєї тварини, щоб знайти пару.
      </p>
      <Link className="button primary" href="/mating/new">
        Створити оголошення
      </Link>
    </section>
  );
}
