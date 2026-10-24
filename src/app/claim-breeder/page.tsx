import type { Metadata } from "next";
import { BreederClaimPage } from "@/features/breeder/claim/claim-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Запрошення власника — Лапа",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ClaimPage() {
  return (
    <main className="page-shell">
      <BreederClaimPage />
    </main>
  );
}
