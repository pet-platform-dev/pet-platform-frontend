import { RequireSession } from "@/features/auth/require-session";
import { PetFormPage } from "@/features/pet/pet-form";
import { petEditorReturn } from "@/features/pet/navigation/editor-return";
export const metadata = { title: "Додати тварину — Лапа" };
export default async function NewPetPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const returnTo = petEditorReturn((await searchParams).returnTo);
  return (
    <RequireSession>
      <main className="pets-shell">
        <PetFormPage returnTo={returnTo} />
      </main>
    </RequireSession>
  );
}
