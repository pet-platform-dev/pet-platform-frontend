import { RequireSession } from "@/features/auth/require-session";
import { PetList } from "@/features/pet/pet-list";
export const metadata = { title: "Мої тварини — Лапа" };
export default function PetsPage() {
  return (
    <RequireSession>
      <main className="pets-shell">
        <PetList />
      </main>
    </RequireSession>
  );
}
