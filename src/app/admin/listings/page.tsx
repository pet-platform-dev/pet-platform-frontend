import { ContentList } from "@/features/admin/content/list";
export const metadata = { title: "Оголошення — Лапа" };
export default function Page() {
  return (
    <main className="catalog-shell">
      <ContentList />
    </main>
  );
}
