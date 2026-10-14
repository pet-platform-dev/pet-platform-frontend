import Link from "next/link";
import { SafeImage } from "@/shared/ui/safe-image";
import { breedLabel } from "@/entities/breed/model";
import { speciesLabel } from "@/entities/species/model";
import { genderLabel } from "@/entities/pet/model";
import { formatPetAge } from "@/shared/lib/format-pet-age";
import type { PetCare } from "./model";
export function PetCareHeader({ pet }: { pet: PetCare }) {
  const name = pet.name?.trim();
  const title =
    name ||
    (pet.breed ? breedLabel(pet.breed) : speciesLabel(pet.species.slug));
  const context = [
    speciesLabel(pet.species.slug),
    name && pet.breed ? breedLabel(pet.breed) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <header className="pet-care-identity">
      <div className="pet-care-photo">
        <SafeImage
          src={pet.profileImage?.thumbnailUrl}
          alt={title}
          width={96}
          height={96}
          fallback={
            <span role="img" aria-label={"Фото тварини відсутнє: " + title}>
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8" cy="8" r="1.5" />
                <path d="m3 17 5-5 4 4 4-6 5 7" />
              </svg>
            </span>
          }
        />
      </div>
      <div className="pet-care-identity-text">
        <p className="eyebrow">Приватний догляд</p>
        <h1>Догляд за твариною</h1>
        <h2>{title}</h2>
        <p className="muted">{context}</p>
        <dl className="pet-care-facts">
          <div>
            <dt>Стать</dt>
            <dd>{genderLabel[pet.gender]}</dd>
          </div>
          <div>
            <dt>Вік</dt>
            <dd>
              {formatPetAge(pet.birthDate, new Date(), { detailed: true }) ??
                "Не вказано"}
            </dd>
          </div>
          {pet.birthDate && (
            <div>
              <dt>Дата народження</dt>
              <dd>
                <time dateTime={pet.birthDate}>
                  {new Intl.DateTimeFormat("uk-UA", { timeZone: "UTC" }).format(
                    new Date(pet.birthDate + "T00:00:00Z"),
                  )}
                </time>
              </dd>
            </div>
          )}
        </dl>
      </div>
      <Link
        className="button secondary pet-care-edit"
        href={"/pets/" + pet.id + "/edit"}
      >
        Редагувати профіль
      </Link>
    </header>
  );
}
