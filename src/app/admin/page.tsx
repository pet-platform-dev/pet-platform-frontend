import { AdminDashboard } from "@/features/admin/dashboard/dashboard";
export const metadata = { title: "Огляд адміністрування — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <AdminDashboard />
    </main>
  );
}
