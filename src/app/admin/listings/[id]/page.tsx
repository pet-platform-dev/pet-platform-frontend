import { ManagedContentDetail } from "@/features/admin/content/detail";
export const metadata = { title: "Оголошення — Лапа" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="catalog-shell">
      <ManagedContentDetail id={id} />
    </main>
  );
}
