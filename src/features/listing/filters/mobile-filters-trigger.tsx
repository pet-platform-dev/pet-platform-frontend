import { activeFilterCount } from "./active-filter-count";
import type { Filters } from "./model";
export function MobileFiltersTrigger({
  filters,
  onOpen,
}: {
  filters: Filters;
  onOpen: () => void;
}) {
  const count = activeFilterCount(filters);
  return (
    <button
      type="button"
      className="button secondary mobile-filters-trigger"
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      {count ? `Фільтри (${count})` : "Фільтри"}
    </button>
  );
}
