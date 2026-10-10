import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { User } from "@/entities/user/model";
import type { OwnBreeder } from "@/entities/breeder/owner-api";
import { BREEDER_MEDIA_LIMITS } from "@/entities/breeder/media";
import { imageError } from "@/features/listing/create-listing/model/images";
import { uploadBreederImage } from "./api";
import { updateBreederMediaCache } from "./cache";
export type UploadItem = {
  key: string;
  type: "LOGO" | "COVER" | "IMAGE";
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "failed";
  error?: string;
};
export function useBreederMedia(
  profile: OwnBreeder,
  onBusy: (busy: boolean) => void,
) {
  const client = useQueryClient(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scope, setScope] = useState<"LOGO" | "COVER" | "IMAGE" | "VIDEO">("IMAGE"),
    [items, setItems] = useState<UploadItem[]>([]);
  const locked = useRef(false),
    requests = useRef(new AbortController()),
    urls = useRef(new Set<string>());
  useEffect(() => {
    requests.current = new AbortController();
    const controller = requests.current,
      previews = urls.current;
    return () => {
      controller.abort();
      for (const url of previews) URL.revokeObjectURL(url);
      onBusy(false);
    };
  }, [onBusy]);
  function isOwner() {
    return (
      client.getQueryData<User | null>(["current-user"])?.id === profile.userId
    );
  }
  function release(item: UploadItem) {
    URL.revokeObjectURL(item.preview);
    urls.current.delete(item.preview);
  }
  async function command(
    action: () => Promise<OwnBreeder>,
    section: typeof scope,
  ) {
    if (locked.current || !isOwner()) return false;
    setScope(section);
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const next = await action();
      const updated = await updateBreederMediaCache(client, next);
      if (updated) router.refresh();
      return updated;
    } catch {
      setError("Не вдалося змінити медіа. Спробуйте ще раз.");
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function upload(batch: UploadItem[]) {
    if (locked.current || !isOwner() || !batch.length) return;
    setScope(batch[0].type);
    locked.current = true;
    setBusy(true);
    onBusy(true);
    try {
      for (const item of batch) {
        if (requests.current.signal.aborted || !isOwner()) break;
        setItems((previous) =>
          previous.map((value) =>
            value.key === item.key ? { ...value, status: "uploading" } : value,
          ),
        );
        try {
          const next = await uploadBreederImage(
            item.type,
            item.file,
            requests.current.signal,
          );
          if (!(await updateBreederMediaCache(client, next))) break;
          release(item);
          setItems((previous) =>
            previous.filter((value) => value.key !== item.key),
          );
        } catch {
          if (!requests.current.signal.aborted)
            setItems((previous) =>
              previous.map((value) =>
                value.key === item.key
                  ? {
                      ...value,
                      status: "failed",
                      error: "Не вдалося завантажити фото. Спробуйте ще раз.",
                    }
                  : value,
              ),
            );
        }
      }
      router.refresh();
    } finally {
      locked.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  function add(type: UploadItem["type"], files: FileList | null) {
    if (!files || locked.current || !isOwner()) return;
    setScope(type);
    setError("");
    const batch: UploadItem[] = [];
    const available =
      type === "IMAGE"
        ? BREEDER_MEDIA_LIMITS.IMAGE -
          profile.media.gallery.length -
          items.filter((item) => item.type === "IMAGE").length
        : 1;
    for (const file of Array.from(files)) {
      const issue = imageError(file);
      if (issue) {
        setError(issue);
        continue;
      }
      if (batch.length >= available) {
        setError("Досягнуто ліміт фотографій розплідника");
        break;
      }
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      batch.push({
        key: crypto.randomUUID(),
        type,
        file,
        preview,
        status: "waiting",
      });
    }
    setItems((previous) => [...previous, ...batch]);
    void upload(batch);
  }
  return {
    busy,
    scope,
    error,
    items,
    add,
    command,
    retry: (item: UploadItem) => void upload([item]),
    discard: (item: UploadItem) => {
      release(item);
      setItems((previous) =>
        previous.filter((value) => value.key !== item.key),
      );
    },
  };
}
