import type { Breeder } from "@/entities/breeder/model";
import { breederImageUrl } from "@/entities/breeder/media";
import { SafeImage } from "@/shared/ui/safe-image";
export function BreederProfileHeader({ profile }: { profile: Breeder }) {
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
        {profile.media?.logo && (
          <SafeImage
            className="breeder-logo"
            src={breederImageUrl(profile.media.logo.url, 192)}
            alt={`Логотип ${profile.kennelName}`}
            width={96}
            height={96}
          />
        )}
        <div>
          <p className="eyebrow">Розплідник</p>
          <h1>{profile.kennelName}</h1>
          {profile.location && (
            <p>
              {profile.location.city}, {profile.location.region}
            </p>
          )}
          <p className="muted">
            Контактна особа: {profile.contactPerson.displayName}
          </p>
        </div>
      </div>
    </header>
  );
}
