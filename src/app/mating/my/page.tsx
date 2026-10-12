import { RequireSession } from "@/features/auth/require-session";
import { MyMating } from "@/features/mating/my-mating";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Мої оголошення про в’язку — Лапа",
};
export default function Page() {
  return (
    <RequireSession returnTo="/mating/my">
      <main className="catalog-shell">
        <MyMating />
      </main>
    </RequireSession>
  );
}
