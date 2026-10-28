import Link from "next/link";
import type { Seller } from "./model";
import { sellerIdentity } from "./model";
import { SafeImage } from "@/shared/ui/safe-image";
export function SellerIdentity({ seller }: { seller: Seller }) {
  return (
    <Link href={`/sellers/${seller.id}`} className="breeder-seller-identity">
      {seller.breeder?.logoUrl && (
        <SafeImage
          src={seller.breeder.logoUrl}
          alt=""
          width="36"
          height="36"
          loading="lazy"
          fallback={<span aria-hidden="true">🐾</span>}
        />
      )}
      <span>
        <span className="muted">
          {seller.breeder ? "Розплідник" : "Продавець"}
        </span>
        <strong>{sellerIdentity(seller)}</strong>
      </span>
    </Link>
  );
}
