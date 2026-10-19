import type { Breeder } from "@/entities/breeder/model";
import { breederImageUrl } from "@/entities/breeder/media";
import { SafeImage } from "@/shared/ui/safe-image";
import { BreederProfileBreeds } from "./breeder-profile-breeds";
export function BreederProfileHeader({ profile }: { profile: Breeder }) {
  const dog = profile.breeds.some((b) => b.species.slug === "dog");
  const cat = profile.breeds.some((b) => b.species.slug === "cat");
  const species = dog ? (cat ? "Собаки та коти" : "Собаки") : cat ? "Коти" : "";
  const fallback = (
    <span className="breeder-logo breeder-profile-initial" aria-hidden="true">
      {Array.from(profile.kennelName.trim())[0]?.toLocaleUpperCase("uk-UA")}
    </span>
  );
  return (
    <header className="listing-detail-panel breeder-profile-header">
      {profile.media?.cover && (
        <div className="breeder-cover">
          <SafeImage
            src={breederImageUrl(profile.media.cover.url, 1440)}
            alt={`Обкладинка ${profile.kennelName}`}
            width={1440}
            height={480}
          />
        </div>
      )}
      <div className="breeder-identity">
        {profile.media?.logo ? (
          <SafeImage
            className="breeder-logo"
            src={breederImageUrl(profile.media.logo.url, 192)}
            alt=""
            width={96}
            height={96}
            fallback={fallback}
          />
        ) : (
          fallback
        )}
        <div>
          <p className="eyebrow">Розплідник</p>
          <h1>{profile.kennelName}</h1>
          {profile.location && (
            <p>
              {profile.location.city}, {profile.location.region}
            </p>
          )}
          {species && <p className="breeder-profile-species">{species}</p>}
          <p className="muted">
            Контактна особа: {profile.contactPerson.displayName}
          </p>
        </div>
      </div>
      <BreederProfileBreeds breeds={profile.breeds} embedded />
    </header>
  );
}
