import Link from "next/link";
import { safeOwnerMatingReturn } from "./detail/navigation";
export function PetMatingActions({
  petId,
  petLabel,
  activeMatingListing,
  returnTo,
}: {
  petId: string;
  petLabel: string;
  activeMatingListing?: { id: string; status: "ACTIVE" } | null;
  returnTo: string;
}) {
  const context = new URLSearchParams({
    returnTo: safeOwnerMatingReturn(returnTo),
  });
  return (
    <section className="pet-mating-actions" aria-label={`В’язка: ${petLabel}`}>
      {activeMatingListing ? (
        <>
          <p className="form-hint">Активне оголошення про в’язку</p>
          <div className="pet-mating-links">
            <Link
              className="button secondary compact"
              aria-label={`Переглянути оголошення про в’язку: ${petLabel}`}
              href={`/mating/${activeMatingListing.id}`}
              prefetch={false}
            >
              Переглянути
            </Link>
            <Link
              className="button secondary compact"
              aria-label={`Редагувати оголошення про в’язку: ${petLabel}`}
              href={`/mating/${activeMatingListing.id}/edit?${context}`}
              prefetch={false}
            >
              Редагувати
            </Link>
          </div>
        </>
      ) : (
        <Link
          className="button secondary compact"
          href={`/mating/new?${new URLSearchParams({ petId, returnTo: safeOwnerMatingReturn(returnTo) })}`}
          aria-label={`Знайти пару: ${petLabel}`}
          prefetch={false}
        >
          Знайти пару
        </Link>
      )}
    </section>
  );
}
