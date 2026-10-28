import type { BreederPackage } from "./package-schema";
import { PreparedCard } from "../handoff/prepared-card";
export function PackagePreview({
  value,
  breederName,
}: {
  value: BreederPackage;
  breederName: string;
}) {
  return (
    <section aria-label="Оголошення в пакеті розплідника" className="auth-form">
      <h3>Оголошень у пакеті: {value.count}</h3>
      <p>
        Прийняття створить приватні профілі цих тварин та чернетки оголошень.
        Публікація відбудеться лише після вашого подання та схвалення
        модерацією.
      </p>
      {value.count === 0 && <p>Пакет не містить оголошень.</p>}
      {value.blockers.length > 0 && (
        <div role="alert">
          <p>
            Прийняття заблоковано. Попросіть оператора виправити матеріали й
            перегляньте пакет повторно.
          </p>
          <ul>
            {value.blockers.map((b) => (
              <li key={b.id}>
                {b.title}: {b.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {value.listings.map((d) => (
        <PreparedCard
          key={d.id}
          draft={d}
          breederName={breederName}
          packagePreview
        />
      ))}
    </section>
  );
}
