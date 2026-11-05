import Link from "next/link";
export function ServiceNotFound() {
  return (
    <main className="catalog-shell services-shell">
      <h1>Сторінка недоступна</h1>
      <p>Послугу або профіль не знайдено. Можливо, публікацію приховано.</p>
      <Link className="button secondary" href="/services">
        До послуг
      </Link>
    </main>
  );
}
