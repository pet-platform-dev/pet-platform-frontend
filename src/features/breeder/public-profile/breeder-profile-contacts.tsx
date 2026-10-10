import { SellerContacts } from "@/entities/seller/seller-card";
import type { Breeder } from "@/entities/breeder/model";
export function BreederProfileContacts({
  contact,
}: {
  contact: Breeder["contactPerson"];
}) {
  if (
    ![contact.phone, contact.telegram, contact.viber, contact.whatsapp].some(
      Boolean,
    )
  )
    return null;
  return (
    <section
      className="listing-detail-panel"
      aria-labelledby="breeder-contacts"
    >
      <h2 id="breeder-contacts">Контакти</h2>
      <SellerContacts
        key={contact.id + (contact.phone ?? "")}
        seller={contact}
      />
    </section>
  );
}
