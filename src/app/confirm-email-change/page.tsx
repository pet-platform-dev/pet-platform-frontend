import type { Metadata } from "next";
import { EmailChangeConfirmation } from "@/features/auth/email-change/confirmation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Зміна електронної пошти — Лапа",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ConfirmEmailChangePage() {
  return (
    <main className="page-shell">
      <EmailChangeConfirmation />
    </main>
  );
}
