export const adminId = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222",
  petId = "33333333-3333-4333-8333-333333333333",
  ownerId = "44444444-4444-4444-8444-444444444444",
  timestamp = "2026-10-13T12:00:00.001Z";
const image = "https://res.cloudinary.com/fixture/image/upload/sample.jpg";
export const identity = { id: ownerId, displayName: "Олександр Єпік" };
export const pet = {
  id: petId,
  name: "Рекс",
  gender: "MALE",
  birthDate: "2020-01-01T00:00:00.000Z",
  species: { id: petId, name: "Собака", slug: "dog" },
  breed: { id: petId, name: "Corgi", nameUk: "Коргі", slug: "corgi" },
  profileImage: { url: image, thumbnailUrl: image },
};
export const location = {
  id: petId,
  city: "Світловодськ",
  region: "Кіровоградська область",
  district: null,
  community: null,
  settlementType: null,
};
const common = {
  id,
  updatedAt: timestamp,
  submittedAt: timestamp,
  moderationStatus: "PENDING",
};
export function queueItem(type = "LISTING") {
  if (type === "REVIEW")
    return {
      ...common,
      type,
      author: identity,
      preview: {
        rating: 4,
        commentExcerpt: "Чудовий детальний відгук.",
        targetUser: identity,
      },
    };
  return {
    ...common,
    type,
    owner: identity,
    preview: {
      title: "Тварина для модерації",
      pet,
      location,
      ...(type === "LISTING"
        ? { price: "100.00", listingType: "SALE", image }
        : { fee: null, image }),
    },
  };
}
export function detail(type = "LISTING") {
  const base = { ...common, moderationReason: null, moderatedAt: null, type };
  if (type === "REVIEW")
    return {
      ...base,
      status: "PENDING",
      rating: 4,
      comment: "Чудовий детальний відгук.",
      interactionContext: "Спілкування",
      createdAt: timestamp,
      author: identity,
      targetUser: identity,
    };
  return {
    ...base,
    title: "Тварина для модерації",
    description: "Повний зміст для перевірки.",
    currency: "UAH",
    status: "DRAFT",
    pet,
    location,
    owner: identity,
    ...(type === "LISTING"
      ? {
          listingType: "SALE",
          price: "100.00",
          images: [{ id, url: image, position: 0 }],
        }
      : { fee: null, requirements: "Умови співпраці" }),
  };
}
export function result(type = "LISTING", action = "approve") {
  const state = { approve: "APPROVED", reject: "REJECTED", hide: "HIDDEN" }[
    action
  ];
  return {
    id,
    type,
    updatedAt: "2026-10-13T12:00:01.001Z",
    moderatedAt: "2026-10-13T12:00:01.000Z",
    moderationReason: action === "approve" ? null : "Виправте опис оголошення.",
    ...(type === "REVIEW"
      ? { status: state, targetUserId: ownerId }
      : {
          status: action === "approve" ? "ACTIVE" : "DRAFT",
          moderationStatus: state,
          petId,
          ownerId,
        }),
  };
}
