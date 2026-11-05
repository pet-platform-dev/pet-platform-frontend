import { ImageGallery } from "@/shared/ui/image-gallery";
import { messengerLinks } from "@/entities/seller/model";
import {
  contactsSchema,
  type ServiceContacts,
  type ServiceLocation,
} from "@/entities/service-offer/model";
export function ServiceGallery({
  images,
  title,
}: {
  images: { id: string; url: string }[];
  title: string;
}) {
  return (
    <ImageGallery
      heading={title}
      images={images.map((i) => ({ ...i, thumbnailUrl: i.url }))}
      emptyFallback={<div className="image-fallback">Фото ще немає</div>}
    />
  );
}
export function ServiceContactsBlock({
  contacts,
}: {
  contacts?: ServiceContacts;
}) {
  const parsed = contactsSchema.safeParse(contacts);
  if (!parsed.success) return null;
  const c = parsed.data;
  const links = [
    ...(c.phone ? [{ label: c.phone, href: `tel:${c.phone}` }] : []),
    ...messengerLinks(c),
    ...(c.website ? [{ label: "Вебсайт", href: c.website }] : []),
  ];
  if (!links.length) return null;
  return (
    <section className="services-panel">
      <h2>Контакти</h2>
      <p className="muted">
        Зв’яжіться з надавачем, щоб уточнити умови послуги.
      </p>
      <div className="services-contact-links">
        {links.map((l) => (
          <a
            key={l.label}
            className="button secondary"
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-label={`Зв’язатися: ${l.label}`}
          >
            {l.label}
          </a>
        ))}
      </div>
    </section>
  );
}
export function ServiceLocations({
  locations,
}: {
  locations: ServiceLocation[];
}) {
  return (
    <section className="services-panel">
      <h2>Локації та територія обслуговування</h2>
      {locations.length ? (
        <ul className="services-locations">
          {locations.map((p) => (
            <li key={p.id}>
              <strong>{p.location.city}</strong>
              <p className="muted">
                {[p.location.region, p.location.district, p.location.community]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p>
                {p.kind === "BASE"
                  ? "Адреса надавача"
                  : "Територія обслуговування"}
                {p.publicAddress ? `: ${p.publicAddress}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Уточніть формат і місце надання послуги у надавача.
        </p>
      )}
    </section>
  );
}
