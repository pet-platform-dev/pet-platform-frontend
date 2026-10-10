import type { ReactNode } from "react";
import { SelectDropdown } from "@/shared/ui/select-dropdown";
import {
  catalogSorts,
  type CatalogSort,
} from "@/entities/listing/model/catalog-query";
const labels: Record<CatalogSort, string> = {
  newest: "Спочатку нові",
  oldest: "Спочатку старі",
  price_asc: "Ціна: від нижчої",
  price_desc: "Ціна: від вищої",
};
export function CatalogSearchSort({
  search,
  sort,
  onSearch,
  onSort,
  filtersTrigger,
}: {
  filtersTrigger?: ReactNode;
  search: string;
  sort: CatalogSort;
  onSearch: (value: string) => void;
  onSort: (value: CatalogSort) => void;
}) {
  return (
    <div className="catalog-search-sort">
      <div className="field catalog-search">
        <label htmlFor="catalog-search">Пошук оголошень</label>
        <input
          id="catalog-search"
          type="search"
          maxLength={100}
          placeholder="Пошук оголошень"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-describedby="catalog-search-hint"
        />
        <p className="hint" id="catalog-search-hint">
          За заголовком, описом або назвою породи.
        </p>
      </div>
      <div className="catalog-filter-sort">
        {filtersTrigger}
        <div className="catalog-sort">
          <span className="catalog-sort-label">Сортування</span>
          <SelectDropdown
            label="Сортування"
            value={sort}
            options={catalogSorts.map((value) => ({
              value,
              label: labels[value],
            }))}
            onChange={onSort}
          />
        </div>
      </div>
    </div>
  );
}
