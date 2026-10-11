import { useEffect, useRef, useState } from "react";
import { imageError } from "@/features/listing/create-listing/model/images";
import { PET_MEDIA_LIMITS, type PetMedia } from "@/entities/pet/media";
import { uploadPetImage } from "./api";
type PendingImage = {
  key: string;
  file: File;
  preview: string;
  failed: boolean;
};
export function usePetGalleryUpload(
  id: string,
  count: number,
  canMutate: () => boolean,
  update: (value: PetMedia) => Promise<void>,
) {
  const [items, setItems] = useState<PendingImage[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const locked = useRef(false),
    urls = useRef(new Set<string>()),
    controller = useRef(new AbortController());
  useEffect(() => {
    const current = new AbortController(),
      previews = urls.current;
    controller.current = current;
    return () => {
      current.abort();
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, [id]);
  function discard(item: PendingImage) {
    URL.revokeObjectURL(item.preview);
    urls.current.delete(item.preview);
    setItems((prev) => prev.filter((value) => value.key !== item.key));
  }
  async function upload(batch: PendingImage[]) {
    if (locked.current || !canMutate()) return;
    locked.current = true;
    setBusy(true);
    try {
      for (const item of batch) {
        if (controller.current.signal.aborted || !canMutate()) break;
        try {
          const next = await uploadPetImage(
            id,
            item.file,
            controller.current.signal,
          );
          if (!canMutate()) break;
          await update(next);
          discard(item);
        } catch {
          if (!controller.current.signal.aborted)
            setItems((prev) =>
              prev.map((value) =>
                value.key === item.key ? { ...value, failed: true } : value,
              ),
            );
        }
      }
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function add(files: FileList | null) {
    if (!files || locked.current || !canMutate()) return;
    setError("");
    const batch: PendingImage[] = [];
    for (const file of Array.from(files)) {
      const issue = imageError(file);
      if (issue) {
        setError(issue);
        continue;
      }
      if (count + items.length + batch.length >= PET_MEDIA_LIMITS.IMAGE) {
        setError("Досягнуто ліміт фотографій тварини");
        break;
      }
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      batch.push({ key: crypto.randomUUID(), file, preview, failed: false });
    }
    setItems((prev) => [...prev, ...batch]);
    void upload(batch);
  }
  return {
    items,
    busy,
    error,
    add,
    discard,
    retry: (item: PendingImage) => void upload([item]),
  };
}
