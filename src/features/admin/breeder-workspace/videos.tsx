"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { BreederVideoEditor } from "@/features/breeder/media/breeder-video-editor";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import type { ManagedBreeder } from "../management/model";
export function WorkspaceVideos({
  profile,
  onSaved,
}: {
  profile: ManagedBreeder;
  onSaved: () => void;
}) {
  const actor = useSession().data!,
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    controller = useRef(new AbortController());
  useEffect(() => {
    controller.current = new AbortController();
    const c = controller.current;
    return () => c.abort();
  }, []);
  const videos = (profile.media ?? []).filter((m) => m.type === "VIDEO");
  async function change(
    path: string,
    method: string,
    body: BodyInit,
  ): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    const generation = currentSessionGeneration();
    try {
      await runAdminRequest(client, actor.id, () =>
        authenticatedRequest(`/admin/breeders/${profile.id}/${path}`, {
          method,
          body,
          signal: controller.current.signal,
        }),
      );
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      ) {
        onSaved();
        return true;
      }
      return false;
    } catch {
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        setError("Не вдалося змінити відео. Оновіть дані та спробуйте ще раз.");
      return false;
    } finally {
      lock.current = false;
      if (generation === currentSessionGeneration()) setBusy(false);
    }
  }
  const fields = {
    source: profile.source,
    expectedUpdatedAt: profile.updatedAt,
  };
  return (
    <section className="dashboard-card" aria-busy={busy}>
      <BreederVideoEditor
        videos={videos.map((v) => ({ ...v, type: "VIDEO" as const }))}
        disabled={busy}
        onAdd={(url) =>
          change("videos", "POST", JSON.stringify({ ...fields, url }))
        }
        onEdit={(id, url) =>
          change("videos/" + id, "PATCH", JSON.stringify({ ...fields, url }))
        }
        onRemove={(id) =>
          void change("media/" + id, "DELETE", JSON.stringify(fields))
        }
        onReorder={(ids) =>
          void change(
            "videos/order",
            "PATCH",
            JSON.stringify({ ...fields, ids }),
          )
        }
      >
        {busy && <p role="status">Зберігаємо відео…</p>}
        {error && <p role="alert">{error}</p>}
      </BreederVideoEditor>
    </section>
  );
}
