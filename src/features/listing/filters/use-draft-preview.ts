"use client";
import { useQuery } from "@tanstack/react-query";
import { getListings } from "@/entities/listing/api/get-listings";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { draftPreviewKey, draftPreviewQuery } from "./draft-preview";
import { priceErrors } from "./price-validation";
import type { Filters } from "./model";
export function useDraftPreview(draft: Filters) {
  const delayed = useDebouncedValue(draft, 350),
    query = draftPreviewQuery(delayed);
  const errors = priceErrors(draft.priceMin, draft.priceMax),
    invalid = Boolean(errors.min || errors.max),
    debouncing = draft !== delayed;
  const result = useQuery({
    queryKey: draftPreviewKey(query),
    queryFn: ({ signal }) => getListings(query, signal),
    enabled: !invalid && !debouncing,
    staleTime: 30_000,
    retry: 1,
  });
  const pending = debouncing || result.isPending || result.isFetching;
  return {
    errors,
    invalid,
    pending,
    error: result.isError,
    total:
      !invalid && !pending && !result.isError
        ? result.data?.meta.total
        : undefined,
  };
}
