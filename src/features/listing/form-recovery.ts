"use client";
import { useEffect, useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

// Tab memory only: no browser storage, credentials or automatic server writes.
// A refresh closes this recovery window; expired upload sessions still require new photos.
const drafts = new Map<string, { value: unknown; expiresAt: number }>();
let generation = 0;
export function recoveredForm<T>(key: string | undefined): T | undefined {
  if (!key) return;
  const entry = drafts.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value as T;
  drafts.delete(key);
}
export function forgetRecoveredForm(key: string) {
  drafts.delete(key);
}
export function clearFormRecovery(keepUserId?: string) {
  generation++;
  for (const key of drafts.keys())
    if (!keepUserId || !key.startsWith(`${keepUserId}:`)) drafts.delete(key);
}
export function useFormRecovery<T extends FieldValues, C>(
  key: string | undefined,
  form: Pick<UseFormReturn<T>, "watch" | "getValues">,
  context: C,
) {
  const revision = useRef(generation);
  useEffect(() => {
    const save = () => {
      if (!key || revision.current !== generation) return;
      if (!drafts.has(key) && drafts.size >= 10)
        drafts.delete(drafts.keys().next().value!);
      drafts.set(key, {
        value: { input: form.getValues(), ...context },
        expiresAt: Date.now() + 30 * 60_000,
      });
    };
    save();
    const subscription = form.watch(save);
    return () => {
      subscription.unsubscribe();
    };
  }, [key, form, context]);
}
