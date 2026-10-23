import type { Metadata } from "next";
import { EmailConfirmation } from "@/features/auth/email-verification/confirmation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Підтвердження пошти — Лапа",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function VerifyEmailPage() {
  return (
    <main className="page-shell">
      <EmailConfirmation />
    </main>
  );
}
