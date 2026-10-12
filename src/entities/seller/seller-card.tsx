"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { messengerLinks, sellerIdentity, type Seller } from "./model";
export function SellerContacts({ seller }: { seller: Seller }) {
  const [revealed, setRevealed] = useState(false);
  const phoneLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (revealed) phoneLink.current?.focus();
  }, [revealed]);
  return (
    <div className="seller-contacts">
      {seller.phone &&
        (revealed ? (
          <a
            ref={phoneLink}
            className="button secondary"
            href={`tel:${seller.phone}`}
          >
            {seller.phone}
          </a>
        ) : (
          <button
            className="button secondary"
            type="button"
            onClick={() => setRevealed(true)}
          >
            Показати телефон
          </button>
        ))}
      {messengerLinks(seller).map((link) => (
        <a
          className="button secondary"
          key={link.label}
          href={link.href}
          target={link.label === "Viber" ? undefined : "_blank"}
          rel="noopener noreferrer"
          aria-label={`Зв’язатися через ${link.label}`}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
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
      <p className="listing-seller-name">{sellerIdentity(seller)}</p>
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
      {children}
      <Link className="button secondary" href={`/sellers/${seller.id}`}>
        Переглянути профіль
      </Link>
    </section>
  );
}
