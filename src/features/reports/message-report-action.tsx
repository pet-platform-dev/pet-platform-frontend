"use client";
import { useSession } from "@/features/auth/session-provider";
import { ReportButton } from "./report-button";
import { useRef } from "react";
export function MessageReportAction({
  id,
  text,
}: {
  id: string;
  text: string;
}) {
  const session = useSession();
  const trigger = useRef<HTMLElement>(null);
  if (!session.data) return null;
  return (
    <details className="message-report-action" key={session.data.id}>
      <summary
        ref={trigger}
        aria-label="Дії з повідомленням"
        title="Дії з повідомленням"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </summary>
      <ReportButton
        targetType="MESSAGE"
        targetId={id}
        ownerId="other-participant"
        messagePreview={text}
        returnFocus={() => trigger.current?.focus()}
      />
    </details>
  );
}
