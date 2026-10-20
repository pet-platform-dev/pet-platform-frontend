import Link from "next/link";
import { BrandLogo } from "@/shared/ui/brand-logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand" href="/" aria-label="Лапа — на головну">
        <BrandLogo />
      </Link>
      <p>З турботою про улюбленців</p>
      <nav className="footer-legal-links" aria-label="Правова інформація">
        <a href="/privacy">Політика конфіденційності</a>
        <a href="/terms">Умови користування</a>
      </nav>
    </footer>
  );
}
