"use client";
import { useId, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBreeds } from "./api";
import { breedLabel } from "@/entities/breed/model";
export type BreedChoice = {
  id: string;
  name: string;
  nameUk: string | null;
  isActive?: boolean;
};
export function BreedSelector({
  species,
  selected,
  onSelect,
  error,
  onSearching,
}: {
  species: "dog" | "cat" | undefined;
  selected: BreedChoice | null;
  onSelect: (breed: BreedChoice | null) => void;
  error?: string;
  onSearching: (value: boolean) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
      setActive(-1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["breeds", { species, search: debounced, page }],
    queryFn: () => getBreeds(species!, debounced, page),
    enabled: Boolean(species),
  });
  const items = query.data?.data ?? [];
  function choose(breed: BreedChoice) {
    onSelect(breed);
    onSearching(false);
    setSearch("");
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="field breed-field">
      <label htmlFor={id}>
        Порода <span className="optional">необов’язково</span>
      </label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && active >= 0 ? `${id}-option-${active}` : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        autoComplete="off"
        placeholder={
          species
            ? "Почніть вводити назву породи"
            : "Спочатку оберіть вид тварини"
        }
        disabled={!species}
        maxLength={100}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          onSearching(Boolean(event.target.value.trim()) && !selected);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((value) => Math.min(value + 1, items.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => Math.max(0, value - 1));
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active >= 0 && items[active]) choose(items[active]);
          }
          if (event.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {selected && (
        <div className="selected-breed">
          <span>
            Обрано: <strong>{breedLabel(selected)}</strong>
            {selected.isActive === false
              ? " · недоступна для нового вибору"
              : ""}
          </span>
          <button
            type="button"
            aria-label="Очистити породу"
            onClick={() => {
              onSelect(null);
              setSearch("");
              onSearching(false);
            }}
          >
            ×
          </button>
        </div>
      )}
      {open && species && (
        <div className="breed-results">
          {query.isPending || query.isFetching ? (
            <p role="status">Завантажуємо породи…</p>
          ) : query.isError ? (
            <div>
              <p role="alert">Не вдалося завантажити породи.</p>
              <button
                type="button"
                className="text-link"
                onClick={() => query.refetch()}
              >
                Спробувати ще раз
              </button>
            </div>
          ) : (
            <>
              <ul id={`${id}-list`} role="listbox" aria-label="Доступні породи">
                {items.map((breed, index) => (
                  <li
                    key={breed.id}
                    role="option"
                    id={`${id}-option-${index}`}
                    aria-selected={breed.id === selected?.id}
                    className={index === active ? "highlighted" : ""}
                  >
                    <button
                      tabIndex={-1}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(breed)}
                    >
                      {breedLabel(breed)}
                    </button>
                  </li>
                ))}
              </ul>
              {!items.length && <p>Порід не знайдено. Спробуйте іншу назву.</p>}
              <div className="breed-pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage(page - 1);
                    setActive(-1);
                  }}
                >
                  Назад
                </button>
                <span>
                  {page} / {Math.max(1, query.data?.meta.pages ?? 1)}
                </span>
                <button
                  type="button"
                  disabled={page >= (query.data?.meta.pages ?? 0)}
                  onClick={() => {
                    setPage(page + 1);
                    setActive(-1);
                  }}
                >
                  Далі
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            className="close-results"
            onClick={() => setOpen(false)}
          >
            Закрити список
          </button>
        </div>
      )}
      <p id={`${id}-hint`} className="form-hint">
        Якщо порода невідома або змішана, залиште поле порожнім. Назви без
        перевіреного перекладу подано англійською.
      </p>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
