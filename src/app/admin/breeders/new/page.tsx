import { BreederCreationWizard } from "@/features/admin/breeder-wizard/wizard";
export const metadata = { title: "Приватна чернетка розплідника — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <BreederCreationWizard />
    </main>
  );
}
