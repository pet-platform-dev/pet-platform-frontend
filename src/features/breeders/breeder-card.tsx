import Link from "next/link";
import type { BreederDirectoryCard as Card } from "@/entities/breeder/directory";
import { breedLabel } from "@/entities/breed/model";
import { breederImageUrl } from "@/entities/breeder/media";
import { SafeImage } from "@/shared/ui/safe-image";
export function BreederCard({ breeder }: { breeder: Card }) {
  const shownBreeds = breeder.breeds.slice(0, 2);
  const remaining = Math.max(0, breeder.breedCount - shownBreeds.length);
  const species = breeder.species.includes("dog")
    ? breeder.species.includes("cat")
      ? "Собаки та коти"
      : "Собаки"
    : breeder.species.includes("cat")
      ? "Коти"
      : "";
  const fallback = (
    <span className="breeder-directory-avatar" aria-hidden="true">
      {Array.from(breeder.kennelName.trim())[0]?.toLocaleUpperCase("uk-UA")}
    </span>
  );
  return (
    <article>
      <Link
        className="breeder-directory-card"
        href={`/sellers/${breeder.userId}`}
        prefetch={false}
        aria-label={`Переглянути розплідник ${breeder.kennelName}`}
      >
        <div className="breeder-directory-identity">
          <span className="breeder-directory-logo">
            {breeder.logo ? (
              <SafeImage
                src={breederImageUrl(breeder.logo.url, 192)}
                width={56}
                height={56}
                alt=""
                loading="lazy"
                fallback={fallback}
              />
            ) : (
              fallback
            )}
          </span>
          <h2>{breeder.kennelName}</h2>
        </div>
        {breeder.location && (
          <p className="breeder-directory-location">
            {breeder.location.city}, {breeder.location.region}
          </p>
        )}
        {species && <p className="breeder-directory-species">{species}</p>}
        {shownBreeds.length > 0 && (
          <ul
            className="breeder-breed-list breeder-directory-breeds"
            aria-label="Породи розплідника"
          >
            {shownBreeds.map((breed) => (
              <li key={breed.id}>
                <span title={breedLabel(breed)}>{breedLabel(breed)}</span>
              </li>
            ))}
            {remaining > 0 && (
              <li
                className="breeder-directory-more"
                aria-label={`Інші породи у профілі: ${remaining}`}
              >
                +{remaining}
              </li>
            )}
          </ul>
        )}
        {breeder.description && (
          <p className="breeder-directory-description">{breeder.description}</p>
        )}
        <span className="breeder-directory-cta">
          Переглянути розплідник <span aria-hidden="true">→</span>
        </span>
      </Link>
    </article>
  );
}
