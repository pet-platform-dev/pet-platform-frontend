import { RequireSession } from "@/features/auth/require-session";
import { CreateListingPage } from "@/features/listing/create-listing/ui/create-listing-page";
export const metadata = {
  title: "Створити оголошення — Лапа",
  robots: { index: false, follow: false },
};
export default function NewListingPage() {
  return (
    <RequireSession>
      <CreateListingPage />
    </RequireSession>
  );
}
