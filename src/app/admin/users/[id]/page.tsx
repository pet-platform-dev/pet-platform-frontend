import { ManagedUserDetail } from "@/features/admin/management/user-detail";
export const metadata = { title: "Обліковий запис — Лапа" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="catalog-shell">
      <ManagedUserDetail id={id} />
    </main>
  );
}
