"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentSessionGeneration } from "@/shared/api/client";
import { createConfirmationState } from "../email-verification/verification-state";
import { refreshVerificationSession as refreshCurrentSession } from "../email-verification/session-sync";
import { notifySessionChange } from "../session-provider";
import { confirmPasswordReset } from "./api";

const ResetContext = createContext<ReturnType<
  typeof createConfirmationState<string>
> | null>(null);

/** Route-instance memory survives page replacement and stable root auth restoration. */
export function ResetSession({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const [controller] = useState(() =>
    createConfirmationState<string>(async (token, password) => {
      const generation = currentSessionGeneration();
      await confirmPasswordReset(token, password);
      try {
        await refreshCurrentSession(client, generation);
      } catch {
        /* Reset succeeded; current-user refetch can retry. */
      }
      notifySessionChange("password-reset");
    }),
  );
  useEffect(() => {
    controller.capture(window.location, window.history);
  }, [controller]);
  return (
    <ResetContext.Provider value={controller}>{children}</ResetContext.Provider>
  );
}
export function useResetSession() {
  const controller = useContext(ResetContext);
  if (!controller) throw new Error("Password reset requires its route session");
  return controller;
}
