export function MobileFiltersHeader({
  titleId,
  onClose,
}: {
  titleId: string;
  onClose: () => void;
}) {
  return (
    <header className="mobile-filters-header">
      <h2 id={titleId}>Фільтри</h2>
      <button
        type="button"
        data-drawer-close
        aria-label="Закрити фільтри"
        onClick={onClose}
      >
        ×
      </button>
    </header>
  );
}
