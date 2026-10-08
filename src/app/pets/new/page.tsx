import { PetFormPage } from "@/features/pet/pet-form";
export const metadata = { title: "Додати тварину — Лапа" };
export default function NewPetPage() {
  return (
    <main className="pets-shell">
      <PetFormPage />
    </main>
  );
}
