import type { Content } from "./model";
import type { ListingImagesHandle } from "@/features/listing/create-listing/ui/listing-images";
import { editorFields, readyDraftError } from "./validation";
export type ContentInput = {
  breederProfileId?: string;
  gender?: string;
  birthDate?: string;
  row: Content | null;
  title: string;
  description: string;
  price: string;
  reason: string;
  kind: string;
  requirements: string;
  status: string;
  transition: string;
  speciesId: string;
  breedId: string | null;
  locationId: string | null;
  photos: ReturnType<ListingImagesHandle["submission"]> | undefined;
  draftDetails: {
    ownerReference: string;
    breederDraftId: string;
  };
};
export function buildContentInput(v: ContentInput) {
  const {
    row,
    title,
    description,
    price,
    reason,
    kind,
    requirements,
    status,
    transition,
    speciesId,
    breedId,
    locationId,
    photos,
    draftDetails,
  } = v;
  const fields = editorFields.parse({
    title,
    description,
    price: price.trim() || null,
    reason,
  });
  if (!row || row.source === "OPERATOR_DRAFT") {
    if (!photos) throw Error("Дочекайтеся завантаження фотографій.");
    const body = {
      ...(v.breederProfileId ? { breederProfileId: v.breederProfileId } : {}),
      gender: v.gender ?? "UNKNOWN",
      birthDate: v.birthDate || null,
      kind,
      title: fields.title,
      description,
      speciesId: speciesId || null,
      breedId,
      locationId,
      breederDraftId: draftDetails.breederDraftId || null,
      price: fields.price,
      currency: "UAH",
      requirements: kind === "MATING" ? requirements || null : null,
      ownerReference: draftDetails.ownerReference || null,
      status,
      imageIds: photos.images.map((i) =>
        "imageId" in i ? i.imageId : i.uploadId,
      ),
      ...(photos.uploadSessionId
        ? { uploadSessionId: photos.uploadSessionId }
        : {}),
      ...(row ? { expectedUpdatedAt: row.updatedAt } : {}),
    };
    const error = readyDraftError(body);
    if (error) throw Error(error);
    return body;
  }
  if (reason.trim().length < 10)
    throw Error("Вкажіть адміністративну причину (щонайменше 10 символів).");
  if (!locationId) throw Error("Оберіть місце оголошення.");
  const body = {
    source: row.source,
    expectedUpdatedAt: row.updatedAt,
    reason: reason.trim(),
    ...(title !== row.title ? { title: fields.title } : {}),
    ...(description !== row.description ? { description } : {}),
    ...(price !== (row.price ?? "") ? { price: fields.price } : {}),
    ...(locationId !== row.location?.id ? { locationId } : {}),
    ...(row.source === "MATING" && requirements !== (row.requirements ?? "")
      ? { requirements: requirements || null }
      : {}),
    ...(transition ? { status: transition } : {}),
  };
  if (Object.keys(body).length === 3)
    throw Error("Вкажіть хоча б одне поле для зміни.");
  return body;
}
