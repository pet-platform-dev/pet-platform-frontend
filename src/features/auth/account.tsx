"use client";
import { useEffect, useState } from "react";
import { DashboardCards } from "./account-dashboard";
import { AdminNavigation } from "@/features/admin/moderation/admin-navigation";
import { accountTypePresentation } from "@/entities/user/account-type";
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
    <section className="account-dashboard" key={user.id}>
      <header className="dashboard-heading">
        <span className="avatar" aria-hidden="true">
          {user.firstName.slice(0, 1).toLocaleUpperCase("uk-UA")}
        </span>
        <div>
          <p className="eyebrow">Особистий простір</p>
          <h1>{[user.firstName, user.lastName].filter(Boolean).join(" ")}</h1>
          <p className="muted">
            {accountTypePresentation[user.accountType].label} ·{" "}
            {statuses[user.verificationStatus]}
          </p>
        </div>
      </header>
      <div className="dashboard-grid">
        <AdminNavigation user={user} />
        <PersonalProfile key={user.id} user={user} />
        <DashboardCards
          userId={user.id}
          accountType={user.accountType}
          breederContent={<AccountBreederLink key={user.id} userId={user.id} />}
        />
      </div>
      <section
        className="dashboard-security"
        aria-labelledby="dashboard-security-title"
      >
        <h2 id="dashboard-security-title">Акаунт і безпека</h2>
        <div className="dashboard-security-grid">
          <dl className="dashboard-account-details">
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
          <div>
            <AccountTypeSettings key={user.id} user={user} />
            <div className="dashboard-session">
              <h3>Сесія</h3>
              {message && (
                <p className="error-banner" role="alert">
                  {message}
                </p>
              )}
              <button
                className="button secondary"
                disabled={pending}
                onClick={exit}
              >
                {pending ? "Виходимо…" : "Вийти з акаунта"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
