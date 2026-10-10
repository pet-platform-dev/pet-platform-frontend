import { ListingFilterControls } from "./listing-filter-controls";
import { hasFilters, type Filters, type FilterUpdate } from "./model";
export function ListingFiltersPanel({
  filters,
  errors,
  onChange,
  onClear,
}: {
  filters: Filters;
  errors: { min?: string; max?: string };
  onChange: (change: FilterUpdate) => void;
  onClear: () => void;
}) {
  return (
    <aside className="listing-filters-panel" aria-label="Фільтри оголошень">
      <div className="filter-heading">
        <h2>Знайти улюбленця</h2>
        <p>Оберіть те, що важливо для вас.</p>
      </div>
      <ListingFilterControls
        filters={filters}
        errors={errors}
        onChange={onChange}
      />
      <button
        type="button"
        className="button secondary"
        disabled={!hasFilters(filters)}
        onClick={onClear}
      >
        Очистити фільтри
      </button>
    </aside>
  );
}
