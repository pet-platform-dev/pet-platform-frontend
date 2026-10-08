import Link from "next/link";
export default function Home() {
  return (
    <main className="home-shell">
      <section className="welcome-card">
        <p className="eyebrow">Ближче до тих, кого любимо</p>
        <h1>
          Велика турбота.
          <br />
          Маленькі лапи.
        </h1>
        <p className="welcome-description">
          Простір для людей, які люблять тварин. Створіть акаунт і зробіть
          перший крок до своєї спільноти.
        </p>
        <div className="welcome-actions">
          <Link className="button primary" href="/register">
            Приєднатися
          </Link>
          <Link className="text-link" href="/login">
            Уже з нами? Увійти →
          </Link>
        </div>
        <div className="welcome-note">
          <span aria-hidden="true">♡</span> З турботою про кожного улюбленця
        </div>
      </section>
      <div className="pet-art" aria-hidden="true">
        <div className="art-orbit" />
        <div className="cat-face">
          <span className="eye eye-left" />
          <span className="eye eye-right" />
          <span className="nose" />
          <span className="whiskers left" />
          <span className="whiskers right" />
        </div>
        <span className="art-heart">♡</span>
        <span className="art-caption">Місце, де починається дружба</span>
      </div>
    </main>
  );
}
