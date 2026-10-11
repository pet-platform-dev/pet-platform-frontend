import { FavoritesPage } from "@/features/favorites/favorites-page";
export const metadata = { title: "Обране — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <FavoritesPage />
    </main>
  );
}
