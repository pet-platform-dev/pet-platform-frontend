import Link from "next/link";
import type { AccountType } from "@/entities/user/account-type";
export function DashboardCards({
  userId,
  accountType,
  breederContent,
}: {
  userId: string;
  accountType: AccountType;
  breederContent: React.ReactNode;
}) {
  return (
    <>
      <section className="dashboard-card" aria-labelledby="dashboard-public">
        <h2 id="dashboard-public">Публічний профіль</h2>
        <p>Контакти та інформація, яку бачать інші користувачі.</p>
        <div className="account-actions">
          <Link className="button secondary" href="/profile">
            Редагувати профіль
          </Link>
          <Link className="button neutral" href={`/sellers/${userId}`}>
            Переглянути профіль
          </Link>
        </div>
      </section>
      {[
        {
          title: "Мої тварини",
          text: "Профілі ваших тварин та їхні фотографії.",
          href: "/pets",
          cta: "До моїх тварин",
        },
        {
          title: "Оголошення",
          text: "Керуйте продажем і прилаштуванням тварин.",
          href: "/my-listings",
          cta: "Мої оголошення",
        },
      ].map((card) => (
        <section className="dashboard-card" key={card.href}>
          <h2>{card.title}</h2>
          <p>{card.text}</p>
          <Link className="button secondary" href={card.href}>
            {card.cta}
          </Link>
        </section>
      ))}
      <section
        className="dashboard-card dashboard-mating"
        aria-labelledby="dashboard-mating"
      >
        <h2 id="dashboard-mating">В’язка</h2>
        <p>Керуйте оголошеннями та шукайте пару для своєї тварини.</p>
        <div className="account-actions">
          <Link className="button secondary" href="/mating/my">
            Мої оголошення
          </Link>
          <Link className="button secondary" href="/mating/new">
            Створити оголошення
          </Link>
        </div>
      </section>
      <section className="dashboard-card">
        <h2>Обране</h2>
        <p>Оголошення, які ви зберегли, щоб повернутися пізніше.</p>
        <Link className="button secondary" href="/favorites">
          Переглянути обране
        </Link>
      </section>
      <section className="dashboard-card">
        <h2>
          <svg
            className="message-nav-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 3h16v13H9l-5 5V3Z" />
          </svg>
          Повідомлення
        </h2>
        <p>Розмови з покупцями та продавцями щодо оголошень.</p>
        <Link className="button secondary" href="/messages">
          До повідомлень
        </Link>
      </section>
      {accountType === "BREEDER" && (
        <section className="dashboard-card">
          <h2>Розплідник</h2>
          <p>Представте свій розплідник та його тварин.</p>
          {breederContent}
        </section>
      )}
    </>
  );
}
