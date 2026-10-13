import { formatPetAge } from "@/shared/lib/format-pet-age";
import { speciesLabel } from "@/entities/species/model";
import type { ModerationDetail } from "./model";
type Ad = Exclude<ModerationDetail, { type: "REVIEW" }>;
export function PetModerationInfo({ pet }: { pet: Ad["pet"] }) {
  return (
    <section className="admin-panel">
      <h2>Тварина</h2>
      <dl className="admin-facts">
        {[
          ["Вид", speciesLabel(pet.species.slug)],
          ["Порода", pet.breed?.nameUk ?? pet.breed?.name ?? "Не вказано"],
          ["Ім’я", pet.name ?? "Не вказано"],
          [
            "Стать",
            pet.gender === "MALE"
              ? "Самець"
              : pet.gender === "FEMALE"
                ? "Самка"
                : "Не вказано",
          ],
          [
            "Вік",
            formatPetAge(pet.birthDate?.slice(0, 10) ?? null) ?? "Не вказано",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function LocationModerationInfo({
  location,
}: {
  location: Ad["location"];
}) {
  return (
    <>
      <h3>Місце розташування</h3>
      <p>
        {[location.city, location.region, location.district, location.community]
          .filter(Boolean)
          .join(", ")}
      </p>
    </>
  );
}
