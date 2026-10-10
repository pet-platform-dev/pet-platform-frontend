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
}: {
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
      <div className="catalog-sort">
        <label htmlFor="catalog-sort">Сортування</label>
        <select
          id="catalog-sort"
          value={sort}
          onChange={(event) => {
            const value = catalogSorts.find(
              (item) => item === event.target.value,
            );
            if (value) onSort(value);
          }}
        >
          {catalogSorts.map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
