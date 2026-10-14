import type { ReactNode } from "react";
export function PetCareSectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"pet-care-card " + className}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function PetCareOverview({
  upcoming,
  reminders,
  history,
}: { upcoming?: ReactNode; reminders?: ReactNode; history?: ReactNode } = {}) {
  return (
    <div className="pet-care-grid">
      <PetCareSectionCard title="Найближчі події" className="pet-care-upcoming">
        {upcoming ?? (
          <>
            <p>Найближчих подій ще немає</p>
            <p className="muted">
              Тут з’являтимуться події догляду, які ви додасте для своєї
              тварини.
            </p>
          </>
        )}
      </PetCareSectionCard>
      <PetCareSectionCard title="Нагадування">
        {reminders ?? (
          <>
            <p>Нагадувань ще немає</p>
            <p className="muted">
              Можливість додавати нагадування з’явиться згодом.
            </p>
          </>
        )}
      </PetCareSectionCard>
      <PetCareSectionCard title="Історія догляду">
        {history ?? (
          <>
            <p>Історія догляду порожня</p>
            <p className="muted">
              Тут зберігатимуться записи, які ви додасте для своєї тварини.
            </p>
          </>
        )}
      </PetCareSectionCard>
      <PetCareSectionCard title="Вакцинації">
        <p>Записів про вакцинацію ще немає</p>
      </PetCareSectionCard>
      <PetCareSectionCard title="Ліки">
        <p>Записів про ліки ще немає</p>
      </PetCareSectionCard>
    </div>
  );
}
