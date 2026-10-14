"use client";
import { useSyncExternalStore } from "react";
function subscribe(listener: () => void) {
  window.addEventListener("focus", listener);
  window.addEventListener("blur", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.removeEventListener("focus", listener);
    window.removeEventListener("blur", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
export function useMessagingVisible() {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "visible" && document.hasFocus(),
    () => false,
  );
}
