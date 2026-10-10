"use client";
import { useId } from "react";
import { ListingFilterControls } from "./listing-filter-controls";
import { MobileFiltersHeader } from "./mobile-filters-header";
import { MobileFiltersFooter } from "./mobile-filters-footer";
import { useFilterDialog } from "./use-filter-dialog";
import { useDraftPreview } from "./use-draft-preview";
import type { Filters, FilterUpdate } from "./model";
export function MobileFiltersDrawer({
  draft,
  onChange,
  onClear,
  onClose,
  onApply,
}: {
  draft: Filters;
  onChange: (update: FilterUpdate) => void;
  onClear: () => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const titleId = useId(),
    { dialog, trapFocus } = useFilterDialog(onClose),
    preview = useDraftPreview(draft);
  return (
    <dialog
      ref={dialog}
      className="mobile-filters-drawer"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <MobileFiltersHeader titleId={titleId} onClose={onClose} />
      <div className="mobile-filters-body">
        <ListingFilterControls
          filters={draft}
          errors={preview.errors}
          onChange={onChange}
        />
      </div>
      <MobileFiltersFooter {...preview} onClear={onClear} onApply={onApply} />
    </dialog>
  );
}
