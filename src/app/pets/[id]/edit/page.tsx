import { PetFormPage } from "@/features/pet/pet-form";
export const metadata = { title: "Редагувати тварину — Лапа" };
export default async function EditPetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="pets-shell">
      <PetFormPage id={id} />
    </main>
  );
}
