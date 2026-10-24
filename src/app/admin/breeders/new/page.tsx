import { ManagedBreederDetail } from "@/features/admin/management/breeder-detail";
export const metadata = { title: "Приватна чернетка розплідника — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <ManagedBreederDetail />
    </main>
  );
}
