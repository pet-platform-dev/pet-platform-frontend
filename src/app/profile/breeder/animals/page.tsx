import Link from "next/link";
import { BreederAnimalsManagement } from "@/features/breeder/animals/breeder-animals-management";
export const metadata = {
  title: "Тварини розплідника — Лапа",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="catalog-shell">
      <Link href="/profile/breeder" className="text-link listing-back-link">
        До профілю розплідника
      </Link>
      <BreederAnimalsManagement />
    </main>
  );
}
