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
export function SellerCard({ seller }: { seller: Seller }) {
  return (
    <section
      className="listing-detail-panel listing-seller-panel"
      aria-label="Продавець"
    >
      <h2>Продавець</h2>
      <p className="listing-seller-name">{sellerIdentity(seller)}</p>
      {seller.breeder && <p className="muted">{seller.displayName}</p>}
      {seller.location && (
        <p>
          {seller.location.city}, {seller.location.region}
        </p>
      )}
      <SellerContacts key={seller.id + (seller.phone ?? "")} seller={seller} />
      <Link className="button secondary" href={`/sellers/${seller.id}`}>
        Переглянути профіль
      </Link>
    </section>
  );
}
