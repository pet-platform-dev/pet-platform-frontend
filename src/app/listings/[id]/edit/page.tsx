import { EditListingPage } from "@/features/listing/manage-listing/edit-listing";
export const metadata = { title: "Редагувати оголошення — Лапа" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="pets-shell">
      <EditListingPage id={id} />
    </main>
  );
}
