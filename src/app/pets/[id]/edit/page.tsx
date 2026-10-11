import { RequireSession } from "@/features/auth/require-session";
import { PetFormPage } from "@/features/pet/pet-form";
import { petEditorReturn } from "@/features/pet/navigation/editor-return";
export const metadata = { title: "Редагувати тварину — Лапа" };
export default async function EditPetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  const returnTo = petEditorReturn((await searchParams).returnTo);
  return (
    <RequireSession>
      <main className="pets-shell">
        <PetFormPage id={id} returnTo={returnTo} />
      </main>
    </RequireSession>
  );
}
