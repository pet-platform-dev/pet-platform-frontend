"use client";
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useFilterDialog } from "@/features/listing/filters/use-filter-dialog";
import { MobileFiltersHeader } from "@/features/listing/filters/mobile-filters-header";
import { applyResultLabel } from "@/features/listing/filters/draft-preview";
import { priceErrors } from "@/features/listing/filters/price-validation";
import { getPublicMating } from "@/entities/mating-listing/public-api";
import { matingQueryKey, type MatingCatalogQuery } from "./query";
import { MatingFilterControls } from "./filter-controls";
import {
  valuesQuery,
  type MatingValues,
  type MatingUpdate,
} from "./filter-state";
export function MatingMobileDrawer({
  values,
  query,
  onChange,
  onClear,
  onClose,
  onApply,
}: {
  values: MatingValues;
  query: MatingCatalogQuery;
  onChange: (c: MatingUpdate) => void;
  onClear: () => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const titleId = useId(),
    { dialog, trapFocus } = useFilterDialog(onClose),
    errors = priceErrors(values.priceMin, values.priceMax),
    invalid = Boolean(errors.min || errors.max),
    candidate = valuesQuery(values, query),
    serial = JSON.stringify(candidate),
    debounced = useDebouncedValue(serial, 350),
    previewQuery = { ...JSON.parse(debounced), limit: 1 } as MatingCatalogQuery;
  const preview = useQuery({
    queryKey: [...matingQueryKey(previewQuery), "preview"],
    queryFn: ({ signal }) => getPublicMating(previewQuery, signal),
    enabled: !invalid,
    staleTime: 15000,
    retry: false,
  });
  const pending = serial !== debounced || preview.isFetching;
  return (
    <dialog
      ref={dialog}
      className="mobile-filters-drawer mating-filters-drawer"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={trapFocus}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <MobileFiltersHeader titleId={titleId} onClose={onClose} />
      <div className="mobile-filters-body">
        <MatingFilterControls
          values={values}
          errors={errors}
          onChange={onChange}
        />
      </div>
      <footer className="mobile-filters-footer">
        <p role="status">
          {invalid
            ? "Перевірте діапазон оплати."
            : preview.isError
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
            {!pending && !preview.isError && preview.data
              ? applyResultLabel(preview.data.meta.total)
              : "Застосувати фільтри"}
          </button>
        </div>
      </footer>
    </dialog>
  );
}
