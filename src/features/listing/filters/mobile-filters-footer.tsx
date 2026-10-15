import { applyResultLabel } from "./draft-preview";
export function MobileFiltersFooter({
  total,
  pending,
  error,
  invalid,
  onClear,
  onApply,
}: {
  total?: number;
  pending: boolean;
  error: boolean;
  invalid: boolean;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <footer className="mobile-filters-footer">
      <p role="status">
        {invalid
          ? "Перевірте діапазон ціни."
          : error
            ? "Кількість недоступна. Можна застосувати фільтри."
            : pending
              ? "Рахуємо пропозиції…"
              : ""}
      </p>
      <div>
        <button type="button" className="button secondary" onClick={onClear}>
          Очистити
        </button>
        <button
          type="button"
          className="button primary"
          disabled={invalid}
          onClick={onApply}
        >
          {total === undefined
            ? "Застосувати фільтри"
            : applyResultLabel(total)}
        </button>
      </div>
    </footer>
  );
}
