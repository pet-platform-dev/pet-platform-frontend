import { listingPetPreselection } from "@/features/listing/create-listing/model/pet-preselection";
import { RequireSession } from "@/features/auth/require-session";
import { CreateListingPage } from "@/features/listing/create-listing/ui/create-listing-page";
export const metadata = {
  title: "Створити оголошення — Лапа",
  robots: { index: false, follow: false },
};
export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const preselectedPetId = listingPetPreselection((await searchParams).petId);
  return (
    <RequireSession>
      <CreateListingPage preselectedPetId={preselectedPetId} />
    </RequireSession>
  );
}
