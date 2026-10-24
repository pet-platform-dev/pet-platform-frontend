import { ManagedPetDetail } from "@/features/admin/content/detail";
export const metadata = { title: "Тварина — Лапа" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="catalog-shell">
      <ManagedPetDetail id={id} />
    </main>
  );
}
