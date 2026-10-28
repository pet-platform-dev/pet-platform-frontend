"use client";
import { SellerContacts } from "./seller-contacts";
import Link from "next/link";
import { messengerLinks, sellerIdentity, type Seller } from "./model";
import { SellerIdentity } from "./seller-identity";
export function SellerCard({
  seller,
  heading = "Продавець",
  hideContacts = false,
  contactHeading,
  children,
}: {
  seller: Seller;
  heading?: string;
  hideContacts?: boolean;
  contactHeading?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="listing-detail-panel listing-seller-panel"
      aria-label={heading}
    >
      <h2>{heading}</h2>
      {seller.breeder ? (
        <SellerIdentity seller={seller} />
      ) : (
        <p className="listing-seller-name">{sellerIdentity(seller)}</p>
      )}
      {seller.breeder && <p className="muted">{seller.displayName}</p>}
      {seller.location && (
        <p>
          {seller.location.city}, {seller.location.region}
        </p>
      )}
      {!hideContacts && (seller.phone || messengerLinks(seller).length > 0) && (
        <>
          {contactHeading && (
            <h3 className="seller-contact-heading">{contactHeading}</h3>
          )}
          <SellerContacts
            key={seller.id + (seller.phone ?? "")}
            seller={seller}
          />
        </>
      )}
      <div className="seller-primary-actions">
        {children}
        <Link className="button secondary" href={`/sellers/${seller.id}`}>
          Переглянути профіль
        </Link>
      </div>
    </section>
  );
}
