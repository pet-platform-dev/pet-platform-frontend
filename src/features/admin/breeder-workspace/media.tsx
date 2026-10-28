"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session-provider";
import {
  authenticatedRequest,
  currentSessionGeneration,
} from "@/shared/api/client";
import { currentAdmin, runAdminRequest } from "../moderation/cache";
import { ImageGallery } from "@/shared/ui/image-gallery";
import type { ManagedBreeder } from "../management/model";
export function WorkspaceMedia({
  profile,
  onSaved,
  types = ["LOGO", "COVER", "IMAGE"],
  heading = "Логотип і обкладинка",
}: {
  profile: ManagedBreeder;
  types?: readonly ("LOGO" | "COVER" | "IMAGE")[];
  heading?: string;
  onSaved: () => void | Promise<unknown>;
}) {
  const actor = useSession().data!,
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const uploadLock = useRef(false),
    lock = useRef(false),
    requests = useRef(new AbortController());
  useEffect(() => {
    requests.current = new AbortController();
    const c = requests.current;
    return () => c.abort();
  }, []);
  async function change(suffix: string, method: string, body: BodyInit) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const generation = currentSessionGeneration();
    try {
      const result = await runAdminRequest(client, actor.id, () =>
        authenticatedRequest<{ updatedAt: string }>(
          `/admin/breeders/${profile.id}/media${suffix}`,
          {
            method,
            body,
            signal: requests.current.signal,
          },
        ),
      );
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      ) {
        await onSaved();
        return result.updatedAt;
      }
    } catch {
      if (
        generation === currentSessionGeneration() &&
        currentAdmin(client, actor.id)
      )
        setMessage(
          "Не вдалося змінити фото. Оновіть дані та спробуйте ще раз.",
        );
    } finally {
      lock.current = false;
      if (generation === currentSessionGeneration()) setBusy(false);
    }
  }
  async function upload(files: File[], type: "LOGO" | "COVER" | "IMAGE") {
    if (uploadLock.current || !files.length) return;
    if (
      (type === "IMAGE" &&
        files.length +
          (profile.media ?? []).filter((m) => m.type === "IMAGE").length >
          20) ||
      files.some(
        (f) =>
          f.size > 8 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(f.type),
      )
    ) {
      setMessage("Оберіть JPEG, PNG або WebP до 8 МБ; у галереї — до 20 фото.");
      return;
    }
    uploadLock.current = true;
    let revision = profile.updatedAt;
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        body.set("type", type);
        body.set("source", profile.source);
        body.set("expectedUpdatedAt", revision);
        const next = await change("", "POST", body);
        if (!next) break;
        revision = next;
      }
    } finally {
      uploadLock.current = false;
    }
  }
  const fields = {
    source: profile.source,
    expectedUpdatedAt: profile.updatedAt,
  };
  const media = profile.media ?? [],
    gallery = media.filter((m) => m.type === "IMAGE");
  return (
    <section
      className="dashboard-card breeder-workspace-media"
      aria-busy={busy}
    >
      <h2>{heading}</h2>
      <p className="muted">
        JPEG, PNG або WebP до 8 МБ. Фотогалерея — до 20 фото. Кожна зміна
        зберігається окремо.
      </p>
      {types.map((type) => (
        <section key={type}>
          <h3>
            {
              { LOGO: "Логотип", COVER: "Обкладинка", IMAGE: "Фотогалерея" }[
                type
              ]
            }
          </h3>
          <div className="field">
            <label htmlFor={`workspace-${type}`}>
              {type === "IMAGE"
                ? "Додати фотографію"
                : "Завантажити або замінити"}
            </label>
            <input
              id={`workspace-${type}`}
              type="file"
              multiple={type === "IMAGE"}
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || (type === "IMAGE" && gallery.length >= 20)}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void upload(files, type);
              }}
            />
          </div>
          <div className="breeder-workspace-photos">
            {media
              .filter((m) => m.type === type)
              .map((m, i) => (
                <article key={m.id}>
                  <Image
                    unoptimized
                    src={m.url}
                    alt={
                      {
                        LOGO: "Логотип розплідника",
                        COVER: "Обкладинка розплідника",
                        IMAGE: `Фото ${i + 1}`,
                      }[type]
                    }
                    width={240}
                    height={150}
                  />
                  <div className="account-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void change(
                          `/${m.id}`,
                          "DELETE",
                          JSON.stringify(fields),
                        )
                      }
                    >
                      Видалити
                    </button>
                    {type === "IMAGE" && (
                      <>
                        <button
                          type="button"
                          className="button secondary"
                          aria-label={`Фото ${i + 1}: перемістити ліворуч`}
                          disabled={busy || i === 0}
                          onClick={() => {
                            const ids = gallery.map((g) => g.id);
                            [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                            void change(
                              "/order",
                              "POST",
                              JSON.stringify({ ...fields, ids }),
                            );
                          }}
                        >
                          Ліворуч
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          aria-label={`Фото ${i + 1}: перемістити праворуч`}
                          disabled={busy || i === gallery.length - 1}
                          onClick={() => {
                            const ids = gallery.map((g) => g.id);
                            [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                            void change(
                              "/order",
                              "POST",
                              JSON.stringify({ ...fields, ids }),
                            );
                          }}
                        >
                          Праворуч
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {!media.some((m) => m.type === type) && (
            <p className="muted">Фото ще не додано.</p>
          )}
        </section>
      ))}
      {types.includes("IMAGE") && gallery.length > 0 && (
        <ImageGallery
          heading={profile.kennelName ?? "Розплідник"}
          images={gallery.map((m) => ({ ...m, thumbnailUrl: m.url }))}
        />
      )}
      {busy && <p role="status">Зберігаємо фото…</p>}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
