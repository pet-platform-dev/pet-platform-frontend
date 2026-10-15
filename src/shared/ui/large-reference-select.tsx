"use client";
import { useMotionPresence } from "@/shared/hooks/use-motion-presence";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import type { Paginated } from "@/shared/api/pagination";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";

const desktopQuery = "(min-width: 768px)";
function subscribeDesktop(listener: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const isDesktop = () => window.matchMedia(desktopQuery).matches;
const mobileSnapshot = () => false;

export function LargeReferenceSelect<T extends { id: string }>({
  label,
  hint,
  placeholder,
  queryKey,
  fetchPage,
  itemLabel,
  itemContext,
  selected,
  selectedIds,
  onSelect,
  onSearching,
  error,
  disabled = false,
  minSearchLength = 0,
  optional = false,
  rowHeight: mobileRowHeight = 96,
  desktopRowHeight = 72,
  clearLabel,
}: {
  label: string;
  hint: string;
  placeholder: string;
  queryKey: QueryKey;
  fetchPage: (search: string, page: number) => Promise<Paginated<T>>;
  itemLabel: (item: T) => string;
  itemContext?: (item: T) => string;
  selected: T | null;
  selectedIds?: readonly string[];
  onSelect: (item: T | null) => void;
  onSearching?: (value: boolean) => void;
  error?: string;
  disabled?: boolean;
  minSearchLength?: number;
  optional?: boolean;
  rowHeight?: number;
  desktopRowHeight?: number;
  clearLabel?: string;
}) {
  const id = useId();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    isDesktop,
    mobileSnapshot,
  );
  const rowHeight = desktop ? desktopRowHeight : mobileRowHeight;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const present = useMotionPresence(open && !disabled);
  const [active, setActive] = useState(-1);
  // Store the position in rows so changing density preserves the visible item.
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollTop = scrollOffset * rowHeight;
  const list = useRef<HTMLUListElement>(null);
  const currentRowHeight = useRef(rowHeight);
  const pendingPage = useRef(false);
  const generation = useRef(0);
  useLayoutEffect(() => {
    currentRowHeight.current = rowHeight;
    if (list.current) list.current.scrollTop = scrollTop;
  }, [rowHeight, scrollTop, open]);
  const term = search.trim();
  const debounced = useDebouncedValue(term);
  const ready = term === debounced && term.length >= minSearchLength;
  const query = useInfiniteQuery({
    // A remounted adapter (e.g. changed Species) starts again at page one.
    queryKey: [...queryKey, id, debounced],
    queryFn: ({ pageParam }) => fetchPage(debounced, pageParam),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.meta.page < page.meta.pages ? page.meta.page + 1 : undefined,
    getPreviousPageParam: (page) =>
      page.meta.page > 1 ? page.meta.page - 1 : undefined,
    maxPages: 10,
    enabled: open && !disabled && ready,
    staleTime: 60_000,
    gcTime: 30_000,
  });
  // Never show the previous term while the new input is debouncing.
  const items = ready
    ? (query.data?.pages.flatMap((page) => page.data) ?? [])
    : [];
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const end = Math.min(items.length, start + 14);
  async function more(direction: "next" | "previous") {
    if (pendingPage.current || query.isFetching || !ready) return;
    if (direction === "next" ? !query.hasNextPage : !query.hasPreviousPage)
      return;
    pendingPage.current = true;
    const first = query.data?.pages[0];
    const currentGeneration = generation.current;
    try {
      const result = await (direction === "next"
        ? query.fetchNextPage()
        : query.fetchPreviousPage());
      if (currentGeneration !== generation.current) return;
      const newFirst = result.data?.pages[0];
      if (
        list.current &&
        first &&
        newFirst &&
        newFirst.meta.page !== first.meta.page
      ) {
        const delta = (first.meta.page - newFirst.meta.page) * first.meta.limit;
        const height = currentRowHeight.current;
        list.current.scrollTop = Math.max(
          0,
          list.current.scrollTop + delta * height,
        );
        setScrollOffset(list.current.scrollTop / height);
        setActive((value) =>
          value >= 0 ? Math.max(-1, value + delta) : value,
        );
      }
    } finally {
      pendingPage.current = false;
    }
  }
  function choose(item: T) {
    onSelect(item);
    onSearching?.(false);
    setSearch("");
    setOpen(false);
    setActive(-1);
  }
  function move(index: number) {
    setActive(index);
    const element = list.current;
    if (!element) return;
    const top = index * rowHeight;
    if (top < element.scrollTop) element.scrollTop = top;
    if (top + rowHeight > element.scrollTop + element.clientHeight)
      element.scrollTop = top + rowHeight - element.clientHeight;
    setScrollOffset(element.scrollTop / rowHeight);
  }
  return (
    <div
      className="field reference-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={id}>
        {label}
        {optional && <span className="optional"> необов’язково</span>}
      </label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={
          open && active >= start && active < end
            ? `${id}-option-${items[active]?.id}`
            : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        autoComplete="off"
        disabled={disabled}
        maxLength={100}
        placeholder={placeholder}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          generation.current++;
          setSearch(event.target.value);
          setOpen(true);
          setActive(-1);
          setScrollOffset(0);
          if (list.current) list.current.scrollTop = 0;
          if (selected) onSelect(null);
          onSearching?.(Boolean(event.target.value.trim()));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            if (items.length)
              move(
                event.key === "ArrowDown"
                  ? Math.min(active + 1, items.length - 1)
                  : Math.max(0, active - 1),
              );
            if (event.key === "ArrowDown" && active >= items.length - 2)
              void more("next");
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (items[active]) choose(items[active]);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {selected && (
        <div className="selected-breed">
          <span>
            Обрано: <strong>{itemLabel(selected)}</strong>
            {itemContext && <small>{itemContext(selected)}</small>}
          </span>
          <button
            type="button"
            aria-label={
              clearLabel ?? `Очистити ${label.toLocaleLowerCase("uk-UA")}`
            }
            onClick={() => {
              onSelect(null);
              onSearching?.(false);
              setSearch("");
              setActive(-1);
            }}
          >
            ×
          </button>
        </div>
      )}
      {present && (
        <div
          className="reference-results motion-surface"
          data-motion={open && !disabled ? "open" : "closed"}
          aria-hidden={!open || disabled}
          inert={!open || disabled}
        >
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-multiselectable={selectedIds ? true : undefined}
            aria-label={`Доступні: ${label}`}
            aria-busy={query.isFetching}
            onScroll={(event) => {
              const element = event.currentTarget;
              setScrollOffset(element.scrollTop / rowHeight);
              if (
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                rowHeight * 2
              )
                void more("next");
              else if (element.scrollTop < rowHeight) void more("previous");
            }}
          >
            {start > 0 && (
              <li role="presentation" style={{ height: start * rowHeight }} />
            )}
            {items.slice(start, end).map((item, offset) => (
              <li
                key={item.id}
                id={`${id}-option-${item.id}`}
                role="option"
                aria-selected={
                  selectedIds
                    ? selectedIds.includes(item.id)
                    : item.id === selected?.id
                }
                aria-posinset={
                  (query.data?.pages[0].meta.page ?? 1) *
                    (query.data?.pages[0].meta.limit ?? 50) -
                  (query.data?.pages[0].meta.limit ?? 50) +
                  start +
                  offset +
                  1
                }
                aria-setsize={query.data?.pages[0].meta.total}
                className={active === start + offset ? "highlighted" : ""}
                style={{ height: rowHeight }}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                >
                  <strong>{itemLabel(item)}</strong>
                  {itemContext && <span>{itemContext(item)}</span>}
                </button>
              </li>
            ))}
            {end < items.length && (
              <li
                role="presentation"
                style={{ height: (items.length - end) * rowHeight }}
              />
            )}
          </ul>
          {term.length < minSearchLength ? (
            <p role="status">Введіть щонайменше {minSearchLength} символи.</p>
          ) : !ready || query.isPending ? (
            <p role="status">Шукаємо…</p>
          ) : query.isError ? (
            <div role="alert">
              <p>Не вдалося завантажити список.</p>
              <button type="button" onClick={() => query.refetch()}>
                Спробувати ще раз
              </button>
            </div>
          ) : !items.length ? (
            <p role="status">Нічого не знайдено. Спробуйте іншу назву.</p>
          ) : query.isFetching ? (
            <p role="status">Завантажуємо…</p>
          ) : null}
        </div>
      )}
      <p id={`${id}-hint`} className="form-hint">
        {hint}
      </p>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
