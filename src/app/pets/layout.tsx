import { RequireSession } from "@/features/auth/require-session";
export default function PetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireSession>{children}</RequireSession>;
}
