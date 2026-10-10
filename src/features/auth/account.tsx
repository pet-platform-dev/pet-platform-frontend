"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountBreederLink } from "@/features/breeder/editor/account-breeder-link";
import { AccountTypeSettings } from "./account-type-settings";
import { PersonalProfile } from "./personal-profile";
import { ApiError } from "@/shared/api/client";
import { useLogout, useSession } from "./session-provider";

const roles = {
  USER: "Користувач",
  BREEDER: "Заводчик",
  MODERATOR: "Модератор",
  ADMIN: "Адміністратор",
};
const statuses = {
  UNVERIFIED: "Не верифіковано",
  PENDING: "Очікує перевірки",
  VERIFIED: "Верифіковано",
  REJECTED: "Верифікацію відхилено",
};
export function Account() {
  const session = useSession();
  const logout = useLogout();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (session.isSuccess && !session.data) router.replace("/login");
  }, [router, session.isSuccess, session.data]);
  if (session.isPending || (session.isSuccess && !session.data))
    return (
      <div className="status-panel" role="status">
        Перевіряємо сесію…
      </div>
    );
  if (session.isError)
    return (
      <div className="status-panel">
        <p role="alert">Не вдалося завантажити профіль.</p>
        <button className="button secondary" onClick={() => session.refetch()}>
          Спробувати ще раз
        </button>
      </div>
    );
  const user = session.data;
  if (!user) return null;
  async function exit() {
    setPending(true);
    setMessage("");
    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Не вдалося вийти. Спробуйте ще раз.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="account-card">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Особистий простір</p>
          <h1>Мій профіль</h1>
        </div>
        <span className="avatar" aria-hidden="true">
          {user.firstName.slice(0, 1).toLocaleUpperCase("uk-UA")}
        </span>
      </div>
      <p className="muted">
        Вітаємо, {user.firstName}! Тут зібрано інформацію про ваш акаунт.
      </p>
      <dl className="profile-details">
        {[
          ["Електронна адреса", user.email],
          ["Роль", roles[user.role]],
          ["Статус верифікації", statuses[user.verificationStatus]],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <PersonalProfile key={user.id} user={user} />
      <AccountTypeSettings key={user.id} user={user} />
      <section
        className="account-section"
        aria-labelledby="account-public-title"
      >
        <h2 id="account-public-title">Публічний профіль</h2>
        <div className="account-actions">
          <Link className="button primary" href="/profile">
            Редагувати публічний профіль
          </Link>
          <Link className="button secondary" href={"/sellers/" + user.id}>
            Переглянути публічний профіль
          </Link>
        </div>
      </section>
      {user.accountType === "BREEDER" && (
        <section
          className="account-section"
          aria-labelledby="account-breeder-title"
        >
          <h2 id="account-breeder-title">Розплідник</h2>
          <AccountBreederLink key={user.id} userId={user.id} />
        </section>
      )}
      {message && (
        <p className="error-banner" role="alert">
          {message}
        </p>
      )}
      <section
        className="account-section"
        aria-labelledby="account-session-title"
      >
        <h2 id="account-session-title">Сесія</h2>
        <div className="account-actions">
          <button
            className="button secondary"
            disabled={pending}
            onClick={exit}
          >
            {pending ? "Виходимо…" : "Вийти з акаунта"}
          </button>
        </div>
      </section>
    </section>
  );
}
