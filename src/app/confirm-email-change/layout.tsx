import { EmailChangeSession } from "@/features/auth/email-change/confirmation-session";
export default function EmailChangeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmailChangeSession>{children}</EmailChangeSession>;
}
