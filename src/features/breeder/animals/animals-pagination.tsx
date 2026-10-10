export function AnimalsPagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="page-pagination" aria-label="Сторінки тварин">
      <button
        className="button secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Назад
      </button>
      <span aria-live="polite">
        {page} / {pages}
      </span>
      <button
        className="button secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Далі
      </button>
    </nav>
  );
}
