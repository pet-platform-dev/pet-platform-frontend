import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { CreateMating } from "@/features/mating/create-mating";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Створити оголошення про в’язку — Лапа",
};
export default function Page() {
  return (
    <RequireSession returnTo="/mating/new">
      <main className="catalog-shell">
        <div className="mating-editor">
          <Link className="back-link" href="/mating/my">
            До моїх оголошень про в’язку
          </Link>
          <header className="catalog-intro">
            <p className="eyebrow">Оголошення про в’язку</p>
            <h1>Створити оголошення про в’язку</h1>
            <p className="muted">
              Оберіть свою тварину, для якої шукаєте пару. Спочатку збережемо
              чернетку, потім ви зможете її опублікувати.
            </p>
          </header>
          <ol className="mating-flow" aria-label="Кроки створення">
            <li>Тварина</li>
            <li>Умови та місце</li>
            <li>Оплата</li>
            <li>Збереження</li>
          </ol>
          <CreateMating />
        </div>
      </main>
    </RequireSession>
  );
}
