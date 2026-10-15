import type { Seller } from "@/entities/seller/model";
import { SellerContacts } from "@/entities/seller/seller-contacts";
import { listingDate } from "@/entities/listing/model/presentation";
export function SellerProfileHeader({ profile }: { profile: Seller }) {
  return (
    <header className="listing-detail-panel">
      <h1>{profile.displayName}</h1>
      {profile.location && (
        <p>
          {profile.location.city}, {profile.location.region}
        </p>
      )}
      <p className="muted">На платформі з {listingDate(profile.memberSince)}</p>
      <SellerContacts
        key={profile.id + (profile.phone ?? "")}
        seller={profile}
      />
    </header>
  );
}
