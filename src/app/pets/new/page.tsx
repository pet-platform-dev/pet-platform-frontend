import { RequireSession } from "@/features/auth/require-session";
import { PetFormPage } from "@/features/pet/pet-form";
export const metadata = { title: "Додати тварину — Лапа" };
export default function NewPetPage() {
  return (
    <RequireSession>
      <main className="pets-shell">
        <PetFormPage />
      </main>
    </RequireSession>
  );
}
