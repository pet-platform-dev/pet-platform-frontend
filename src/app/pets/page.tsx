import { PetList } from "@/features/pet/pet-list";
export const metadata = { title: "Мої тварини — Лапа" };
export default function PetsPage() {
  return (
    <main className="pets-shell">
      <PetList />
    </main>
  );
}
