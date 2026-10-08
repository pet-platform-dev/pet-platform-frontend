import type { Metadata } from "next";
import { SessionProvider } from "@/features/auth/session-provider";
import { Header } from "@/widgets/header/header";
import "./globals.css";
export const metadata: Metadata = {
  title: "Лапа — з турботою про улюбленців",
  description: "Ваш простір для турботи про улюбленців.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk">
      <body>
        <SessionProvider>
          <Header />
          {children}
          <footer className="site-footer">
            Лапа · З турботою про улюбленців
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
