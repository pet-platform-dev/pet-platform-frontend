import {
  safeOwnerMatingReturn,
  ownerMatingReturnLabel,
  matingCreateHref,
} from "@/features/mating/detail/navigation";
import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { CreateMating } from "@/features/mating/create-mating";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Створити оголошення про в’язку — Лапа",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const returnTo = safeOwnerMatingReturn(query.returnTo);
  const petId = query.petId;
  return (
    <RequireSession returnTo={matingCreateHref(petId, query.returnTo)}>
      <main className="catalog-shell">
        <div className="mating-editor">
          <Link className="back-link" href={returnTo}>
            {ownerMatingReturnLabel(returnTo)}
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
          <CreateMating petId={petId} returnTo={returnTo} />
        </div>
      </main>
    </RequireSession>
  );
}
