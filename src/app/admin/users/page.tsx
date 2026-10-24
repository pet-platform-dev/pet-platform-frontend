import { ManagementList } from "@/features/admin/management/list";
export const metadata = { title: "Користувачі — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <ManagementList kind="users" />
    </main>
  );
}
