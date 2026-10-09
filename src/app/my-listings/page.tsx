import { MyListingsPage } from "@/features/listing/manage-listing/my-listings";
export const metadata = { title: "Мої оголошення — Лапа" };
export default function Page() {
  return (
    <main className="pets-shell">
      <MyListingsPage />
    </main>
  );
}
