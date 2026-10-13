"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionKey, useSession } from "@/features/auth/session-provider";
import type { User } from "@/entities/user/model";
import { favoriteLoginHref } from "@/features/favorites/login-return";
import { ApiError } from "@/shared/api/client";
import { createReport } from "./api";
import {
  canReport,
  reportInputSchema,
  type ReportType,
  type ReportReason,
} from "./model";
import { ReportDialog } from "./report-dialog";
export const reportSentKey = (userId: string, type: ReportType, id: string) =>
  ["report-sent", userId, type, id] as const;
export function ReportButton({
  targetType,
  targetId,
  ownerId,
}: {
  targetType: ReportType;
  targetId: string;
  ownerId: string;
}) {
  const session = useSession();
  if (!canReport(session.data?.id, ownerId)) return null;
  return (
    <ReportAction
      key={(session.data?.id ?? "anonymous") + targetType + targetId}
      targetType={targetType}
      targetId={targetId}
      userId={session.data?.id}
      ready={session.isSuccess}
    />
  );
}
function ReportAction({
  targetType,
  targetId,
  userId,
  ready,
}: {
  targetType: ReportType;
  targetId: string;
  userId?: string;
  ready: boolean;
}) {
  const client = useQueryClient(),
    router = useRouter(),
    trigger = useRef<HTMLButtonElement>(null),
    locked = useRef(false);
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState<ReportReason>("SPAM"),
    [details, setDetails] = useState(""),
    [error, setError] = useState("");
  const sent = useQuery({
    queryKey: reportSentKey(userId ?? "", targetType, targetId),
    queryFn: () => false,
    initialData: false,
    enabled: false,
  });
  const current = () =>
    !!userId && client.getQueryData<User | null>(sessionKey)?.id === userId;
  const mutation = useMutation({
    mutationKey: ["user-reports", userId, targetType, targetId],
    retry: false,
    mutationFn: async () => {
      if (!current()) throw new DOMException("Session changed", "AbortError");
      const data = await createReport(targetType, targetId, reason, details);
      if (!current()) throw new DOMException("Session changed", "AbortError");
      return data;
    },
    onSuccess: () => {
      if (!current()) return;
      client.setQueryData(reportSentKey(userId!, targetType, targetId), true);
      setOpen(false);
      trigger.current?.focus();
    },
    onError: (e) => {
      if (!current()) return;
      if (e instanceof ApiError && e.status === 409) {
        client.setQueryData(reportSentKey(userId!, targetType, targetId), true);
        setOpen(false);
      } else
        setError(
          e instanceof ApiError && e.status === 404
            ? "Матеріал уже недоступний для скарги."
            : e instanceof ApiError && e.status === 403
              ? "Скаргу не можна надіслати. Оновіть сторінку."
              : "Не вдалося надіслати скаргу. Спробуйте ще раз.",
        );
    },
    onSettled: () => {
      locked.current = false;
    },
  });
  function submit() {
    if (locked.current) return;
    const input = reportInputSchema.safeParse({
      targetType,
      targetId,
      reason,
      details,
    });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    setError("");
    locked.current = true;
    mutation.mutate();
  }
  return (
    <div className="report-action">
      <button
        ref={trigger}
        type="button"
        className="button secondary compact"
        disabled={!ready || sent.data}
        onClick={() => {
          if (!userId) {
            router.push(
              favoriteLoginHref(
                window.location.pathname + window.location.search,
              ),
            );
            return;
          }
          setError("");
          setOpen(true);
        }}
      >
        {sent.data ? "Скаргу надіслано" : "Поскаржитися"}
      </button>
      {sent.data && (
        <p role="status" className="form-hint">
          Скаргу надіслано.
        </p>
      )}
      {open && (
        <ReportDialog
          reason={reason}
          details={details}
          onReason={setReason}
          onDetails={setDetails}
          onSubmit={submit}
          onClose={() => setOpen(false)}
          pending={mutation.isPending}
          error={error}
          returnFocus={() => trigger.current?.focus()}
        />
      )}
    </div>
  );
}
