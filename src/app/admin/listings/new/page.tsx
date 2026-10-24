import { ManagedContentDetail } from "@/features/admin/content/detail";
export const metadata = { title: "Підготувати оголошення — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <ManagedContentDetail />
    </main>
  );
}
