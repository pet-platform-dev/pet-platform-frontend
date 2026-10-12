import {
  safeOwnerMatingReturn,
  ownerMatingReturnLabel,
  matingEditHref,
} from "@/features/mating/detail/navigation";
import Link from "next/link";
import { RequireSession } from "@/features/auth/require-session";
import { EditMating } from "@/features/mating/edit-mating";
export const metadata = {
  robots: { index: false, follow: false },
  title: "Керування оголошенням про в’язку — Лапа",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const returnTo = safeOwnerMatingReturn((await searchParams).returnTo);
  return (
    <RequireSession returnTo={matingEditHref(id, returnTo)}>
      <main className="catalog-shell">
        <div className="mating-editor">
          <Link className="back-link" href={returnTo}>
            {ownerMatingReturnLabel(returnTo)}
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
