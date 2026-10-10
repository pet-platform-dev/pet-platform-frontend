"use client";
import { useCallback, useState } from "react";
import { copyFilters, changeDraft, clearDraft } from "./filter-state";
import type { Filters, FilterUpdate } from "./model";
export function useMobileFilters(
  applied: Filters,
  onApply: (filters: Filters) => void,
) {
  const [draft, setDraft] = useState<Filters | null>(null);
  const close = useCallback(() => setDraft(null), []);
  function open() {
    setDraft(copyFilters(applied));
  }
  function update(change: FilterUpdate) {
    setDraft((current) => (current ? changeDraft(current, change) : null));
  }
  function clear() {
    setDraft((current) => (current ? clearDraft(current) : null));
  }
  function apply() {
    if (draft) {
      onApply(copyFilters(draft));
      close();
    }
  }
  return { draft, open, close, update, clear, apply };
}
