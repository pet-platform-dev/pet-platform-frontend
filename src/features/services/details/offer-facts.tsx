import type { ServiceOffer } from "@/entities/service-offer/model";
const names: Record<string, string> = {
  coverage: "Географія перевезення",
  transportFormat: "Формат перевезення",
  operatingArea: "Напрямки",
  accompanied: "Супровід власника",
  maxWeightKg: "Максимальна вага, кг",
  petSizes: "Розміри тварин",
  techniques: "Процедури",
  sessionFormat: "Формат занять",
  focusAreas: "Напрямки навчання",
  conditions: "Умови",
  setting: "Проживання",
  capacity: "Кількість місць",
  vaccinationRequired: "Потрібна вакцинація",
  careFormat: "Формат догляду",
  walkDurationMinutes: "Тривалість прогулянки, хв",
};
const values: Record<string, string> = {
  LOCAL: "Місцеві",
  INTERCITY: "Міжміські",
  INTERNATIONAL: "Міжнародні",
  INDIVIDUAL: "Індивідуально",
  SHARED: "Спільне перевезення",
  PET_TAXI: "Зоотаксі",
  SMALL: "Малі",
  MEDIUM: "Середні",
  LARGE: "Великі",
  GIANT: "Гігантські",
  GROUP: "У групі",
  BOTH: "Індивідуально та у групі",
  HOME: "У домашніх умовах",
  FACILITY: "У спеціальному приміщенні",
  HOME_VISITS: "Візити додому",
  IN_HOME_CARE: "Догляд із проживанням",
};
function label(value: unknown): string {
  if (typeof value === "boolean") return value ? "Так" : "Ні";
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (typeof value === "string") return values[value] ?? value;
  return typeof value === "number" ? String(value) : "";
}
export function ServiceOfferFacts({ offer }: { offer: ServiceOffer }) {
  const details = Object.entries(offer.details ?? {}).filter(
    ([key, value]) => names[key] && label(value),
  );
  if (!details.length) return null;
  return (
    <section className="services-panel">
      <h2>Про послугу</h2>
      <dl className="services-facts">
        {details.map(([key, value]) => (
          <div key={key}>
            <dt>{names[key]}</dt>
            <dd>{label(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        Інформацію про умови надає спеціаліст або організація.
      </p>
    </section>
  );
}
