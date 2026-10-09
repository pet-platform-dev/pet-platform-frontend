import { ProfileEditor } from "@/features/profile/profile-editor";
export const metadata = {
  title: "Публічний профіль — Лапа",
  robots: { index: false, follow: false },
};
export default function ProfilePage() {
  return (
    <main className="page-shell profile-editor">
      <ProfileEditor />
    </main>
  );
}
