import type { z } from "zod";
import { ImageGallery } from "@/shared/ui/image-gallery";
import { speciesLabel } from "@/entities/species/model";
import type { draftSchema } from "./contracts";

const kindLabels = {
  SALE: "Продаж",
  FREE: "Безкоштовно",
  ADOPTION: "Прилаштування",
  MATING: "В’язка",
};
export function PreparedCard({
  draft: d,
  breederName,
  packagePreview = false,
}: {
  draft: z.infer<typeof draftSchema>;
  breederName: string;
  packagePreview?: boolean;
}) {
  return (
    <article className="dashboard-card auth-form">
      <h3>{d.title}</h3>
      <p>Розплідник: {breederName}</p>
      <p>
        {kindLabels[d.kind]} ·{" "}
        {d.species?.slug ? speciesLabel(d.species.slug) : d.species?.name}
        {d.breed && <> · {d.breed.nameUk ?? d.breed.name}</>}
      </p>
      <p>
        {d.price
          ? `${d.price} грн`
          : d.kind === "SALE"
            ? "Ціна за домовленістю"
            : kindLabels[d.kind]}
      </p>
      <p>
        Стан підготовки:{" "}
        {d.status === "READY_FOR_REVIEW" ? "Готове до передачі" : "Чернетка"}
      </p>
      <p>{d.description}</p>
      {!packagePreview && <p>Очікує передачі адміністратором</p>}
      {d.images.length > 0 && (
        <ImageGallery
          heading={d.title}
          images={d.images.map((m) => ({ ...m, thumbnailUrl: m.url }))}
        />
      )}
    </article>
  );
}
