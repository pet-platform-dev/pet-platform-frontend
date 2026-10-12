import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { EditMating } from "@/features/mating/edit-mating";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Керування оголошенням про в’язку — Лапа",
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireSession returnTo={`/mating/${id}/edit`}>
      <main className="catalog-shell">
        <div className="mating-editor">
          <Link className="back-link" href="/mating/my">
            До моїх оголошень про в’язку
          </Link>
          <header className="catalog-intro">
            <h1>Оголошення про в’язку</h1>
          </header>
          <EditMating id={id} />
        </div>
      </main>
    </RequireSession>
  );
}
