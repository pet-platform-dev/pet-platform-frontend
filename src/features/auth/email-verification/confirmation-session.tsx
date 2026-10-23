"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentSessionGeneration } from "@/shared/api/client";
import { notifySessionChange } from "../session-provider";
import { confirmEmail } from "./api";
import { refreshVerificationSession } from "./session-sync";
import { createConfirmationState } from "./verification-state";

const ConfirmationContext = createContext<ReturnType<
  typeof createConfirmationState<void>
> | null>(null);

/** A route-layout instance owns the credential; replacing its page cannot lose it. */
export function ConfirmationSession({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const [controller] = useState(() =>
    createConfirmationState(async (token) => {
      const generation = currentSessionGeneration();
      await confirmEmail(token);
      // Confirmation has succeeded even if refreshing this browser's user fails.
      try {
        await refreshVerificationSession(client, generation);
      } catch {
        /* ordinary account refetch can retry */
      }
      notifySessionChange("email-verification");
    }),
  );
  useEffect(() => {
    controller.capture(window.location, window.history);
  }, [controller]);
  return (
    <ConfirmationContext.Provider value={controller}>
      {children}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmationSession() {
  const controller = useContext(ConfirmationContext);
  if (!controller) throw new Error("Verification requires its route session");
  return controller;
}
