import { ManagementList } from "@/features/admin/management/list";
export const metadata = { title: "Адміністрування розплідників — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <ManagementList kind="breeders" />
    </main>
  );
}
