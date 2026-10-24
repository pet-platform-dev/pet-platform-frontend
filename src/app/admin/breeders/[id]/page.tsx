import { ManagedBreederDetail } from "@/features/admin/management/breeder-detail";
export const metadata = { title: "Адміністрування профілю розплідника — Лапа" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="catalog-shell">
      <ManagedBreederDetail id={id} />
    </main>
  );
}
