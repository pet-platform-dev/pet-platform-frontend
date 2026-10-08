import Link from "next/link";
export function ListingUnavailable() {
  return (
    <section className="catalog-state listing-detail-state">
      <p className="eyebrow">Оголошення недоступне</p>
      <h1>Оголошення не знайдено</h1>
      <p>Можливо, його було видалено, завершено або воно більше недоступне.</p>
      <Link href="/listings" className="button primary">
        Повернутися до оголошень
      </Link>
    </section>
  );
}
export function ListingDetailError({
  retry,
  pending = false,
}: {
  retry: () => void;
  pending?: boolean;
}) {
  return (
    <section className="catalog-state listing-detail-state" role="alert">
      <h1>Не вдалося завантажити оголошення</h1>
      <p>Перевірте з’єднання та спробуйте ще раз.</p>
      <button className="button primary" onClick={retry} disabled={pending}>
        {pending ? "Завантажуємо…" : "Спробувати ще раз"}
      </button>
    </section>
  );
}
