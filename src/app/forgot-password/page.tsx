import type { Metadata } from "next";
import { ForgotPassword } from "@/features/auth/password-recovery/forgot-password";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Відновлення пароля — Лапа",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ForgotPasswordPage() {
  return (
    <main className="page-shell">
      <ForgotPassword />
    </main>
  );
}
