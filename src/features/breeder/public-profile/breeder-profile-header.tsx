import type { Breeder } from "@/entities/breeder/model";
export function BreederProfileHeader({ profile }: { profile: Breeder }) {
  return (
    <header className="listing-detail-panel breeder-profile-header">
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
    </header>
  );
}
