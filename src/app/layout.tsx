import type { Metadata } from "next";
import { SessionProvider } from "@/features/auth/session-provider";
import { Header } from "@/widgets/header/header";
import { FavoriteProvider } from "@/features/favorites/favorite-provider";
import { MessagingRealtime } from "@/features/conversations/messaging-realtime";
import { SiteFooter } from "@/widgets/footer/site-footer";
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
          <MessagingRealtime />
          <FavoriteProvider>
            <Header />
            {children}
            <SiteFooter />
          </FavoriteProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
