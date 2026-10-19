import { BreederMediaViewer } from "./breeder-media-viewer";
import { BreederProfileVideos } from "./breeder-profile-videos";
import type { Breeder } from "@/entities/breeder/model";
import { BreederProfileHeader } from "./breeder-profile-header";
import { BreederProfileAbout } from "./breeder-profile-about";
import type { ReactNode } from "react";
import { BreederProfileContacts } from "./breeder-profile-contacts";
import { BreederProfileDetails } from "./breeder-profile-details";
export function BreederProfilePage({
  profile,
  children,
}: {
  profile: Breeder;
  children?: ReactNode;
}) {
  return (
    <>
      <BreederProfileHeader profile={profile} />
      <BreederProfileAbout description={profile.description} />
      {children}
      <BreederProfileContacts contact={profile.contactPerson} />
      <BreederProfileDetails profile={profile} />
      <BreederMediaViewer profile={profile} />
      <BreederProfileVideos videos={profile.media?.videos ?? []} />
    </>
  );
}
