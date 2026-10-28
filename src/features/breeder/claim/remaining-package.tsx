"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { useSession } from "@/features/auth/session-provider";
import { packageSchema } from "./package-schema";
import { PackagePreview } from "./package-preview";
const schema = packageSchema.extend({
  breeder: z.object({ id: z.uuid(), kennelName: z.string() }),
});
export function RemainingPackage({
  userId,
  profileId,
}: {
  userId: string;
  profileId: string;
}) {
  const session = useSession(),
    client = useQueryClient(),
    router = useRouter();
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    lock = useRef(false);
  const query = useQuery({
    queryKey: ["breeder-handoffs", userId, "package", profileId],
    queryFn: async ({ signal }) =>
      schema.parse(
        await authenticatedRequest(`/breeder-claims/packages/${profileId}`, {
          signal,
        }),
      ),
    enabled:
      session.data?.id === userId &&
      session.data.accountType === "BREEDER" &&
      session.data.verificationStatus === "VERIFIED",
    retry: false,
  });
  if (session.data?.id !== userId) return null;
  if (
    session.data.accountType !== "BREEDER" ||
    session.data.verificationStatus !== "VERIFIED"
  )
    return <p>Підтвердьте пошту акаунта заводчика, щоб переглянути пакет.</p>;
  if (query.isPending) return <p role="status">Перевіряємо пакет оголошень…</p>;
  if (query.isError)
    return (
      <p role="alert">
        Не вдалося перевірити пакет.{" "}
        <button onClick={() => void query.refetch()}>
          Повторити перегляд пакета
        </button>
      </p>
    );
  if (!query.data.count) return null;
  return (
    <section
      className="dashboard-card auth-form"
      aria-label="Прийняття залишку пакета"
    >
      <h2>Підготовлені оголошення</h2>
      <p>
        Розплідник уже належить вам. Прийміть пов’язаний залишок одним
        підтвердженням; повторна реєстрація чи запрошення не потрібні.
      </p>
      <PackagePreview
        value={query.data}
        breederName={query.data.breeder.kennelName}
      />
      <button
        className="button primary"
        disabled={busy || !query.data.canAccept}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setMessage("");
          const generation = currentSessionGeneration();
          try {
            await authenticatedRequest(
              `/breeder-claims/packages/${profileId}/accept`,
              {
                method: "POST",
                body: JSON.stringify({
                  confirmPackage: true,
                  packageRevision: query.data.revision,
                }),
              },
            );
            if (
              generation !== currentSessionGeneration() ||
              client.getQueryData<{ id: string }>(["current-user"])?.id !==
                userId
            )
              return;
            await Promise.all(
              [
                ["my-listings", userId],
                ["my-pets"],
                ["breeder-handoffs", userId],
                ["own-breeder", userId],
                ["breeder-animals", userId],
              ].map((queryKey) => client.invalidateQueries({ queryKey })),
            );
            await session.refetch();
            if (
              generation === currentSessionGeneration() &&
              client.getQueryData<{ id: string }>(["current-user"])?.id ===
                userId
            )
              router.push("/my-listings");
          } catch {
            if (generation === currentSessionGeneration()) {
              setMessage(
                "Не вдалося прийняти пакет. Перегляньте актуальні матеріали та причини блокування.",
              );
              void query.refetch();
            }
          } finally {
            lock.current = false;
            if (generation === currentSessionGeneration()) setBusy(false);
          }
        }}
      >
        {busy ? "Приймаємо…" : "Прийняти всі оголошення пакета"}
      </button>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void query.refetch()}
      >
        Оновити перегляд пакета
      </button>
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
