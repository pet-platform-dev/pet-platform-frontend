import Link from "next/link";
import { HomeParkArt } from "./home-park-art";

export function HomeHero() {
  return (
    <main className="home-shell">
      <HomeParkArt />
      <div className="home-hero-grid">
        <section className="welcome-card" aria-labelledby="home-title">
          <p className="eyebrow">Ближче до тих, кого любимо</p>
          <h1 id="home-title">
            Велика турбота.
            <br />
            Маленькі <span>лапи.</span>
          </h1>
          <p className="welcome-description">
            Простір для людей, які люблять тварин. Створіть акаунт і зробіть
            перший крок до своєї спільноти.
          </p>
          <div className="welcome-actions">
            <Link className="button primary" href="/listings">
              Переглянути оголошення
            </Link>
            <Link className="button secondary" href="/register">
              Створити акаунт
            </Link>
          </div>
          <p className="welcome-note">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M20.5 5.5c-2.3-2.3-5.8-1.2-8.5 1.6C9.3 4.3 5.8 3.2 3.5 5.5c-3.8 4 1.8 9.2 8.5 14 6.7-4.8 12.3-10 8.5-14Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            З турботою про кожного улюбленця
          </p>
        </section>
      </div>
    </main>
  );
}
