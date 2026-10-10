"use client";
import { useCallback, useState } from "react";
import { copyFilters, changeDraft, clearDraft } from "./filter-state";
import type { Filters, FilterUpdate } from "./model";
export function useMobileFilters(
  applied: Filters,
  onApply: (filters: Filters, cleared?: boolean) => void,
  version = "",
) {
  const [session, setSession] = useState<{
    draft: Filters;
    version: string;
    cleared: boolean;
  } | null>(null);
  if (session && session.version !== version) setSession(null);
  const draft = session?.version === version ? session.draft : null;
  const close = useCallback(() => setSession(null), []);
  function open() {
    setSession({ draft: copyFilters(applied), version, cleared: false });
  }
  function update(change: FilterUpdate) {
    setSession((current) =>
      current
        ? { ...current, draft: changeDraft(current.draft, change) }
        : null,
    );
  }
  function clear() {
    setSession((current) =>
      current
        ? {
            ...current,
            draft: clearDraft(),
            cleared: true,
          }
        : null,
    );
  }
  function apply() {
    if (draft) {
      onApply(copyFilters(draft), session?.cleared);
      close();
    }
  }
  return { draft, open, close, update, clear, apply };
}
