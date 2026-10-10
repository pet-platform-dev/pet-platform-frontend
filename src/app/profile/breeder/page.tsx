import { BreederEditor } from "@/features/breeder/editor/breeder-editor";
export const metadata = {
  title: "Профіль заводчика — Лапа",
  robots: { index: false, follow: false },
};
export default function BreederEditorPage() {
  return (
    <main className="catalog-shell breeder-editor">
      <BreederEditor />
    </main>
  );
}
