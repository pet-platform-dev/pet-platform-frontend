"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createRegistrationLegalState } from "./registration-legal-state";

export function useRegistrationLegal(enabled: boolean) {
  const [controller] = useState(() => createRegistrationLegalState());
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  useEffect(() => {
    if (!enabled) return;
    void controller.refresh();
    return controller.cancel;
  }, [enabled, controller]);
  return { state, controller };
}
