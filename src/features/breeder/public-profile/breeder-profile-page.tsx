import { BreederMediaViewer } from "./breeder-media-viewer";
import { BreederProfileVideos } from "./breeder-profile-videos";
import type { Breeder } from "@/entities/breeder/model";
import { BreederProfileHeader } from "./breeder-profile-header";
import { BreederProfileAbout } from "./breeder-profile-about";
import { BreederProfileBreeds } from "./breeder-profile-breeds";
import { BreederProfileContacts } from "./breeder-profile-contacts";
import { BreederProfileDetails } from "./breeder-profile-details";
export function BreederProfilePage({ profile }: { profile: Breeder }) {
  return (
    <>
      <BreederProfileHeader profile={profile} />
      <BreederProfileContacts contact={profile.contactPerson} />
      <BreederProfileAbout description={profile.description} />
      <BreederProfileBreeds breeds={profile.breeds} />
      <BreederProfileDetails profile={profile} />
      <BreederMediaViewer profile={profile} />
      <BreederProfileVideos videos={profile.media?.videos ?? []} />
    </>
  );
}
