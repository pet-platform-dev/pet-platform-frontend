import Image from "next/image";

export function BrandLogo() {
  return (
    <Image
      className="brand-logo"
      src="/brand/logo.png"
      width={1442}
      height={318}
      sizes="(max-width: 374px) 128px, (max-width: 1023px) 136px, 154px"
      alt="Лапа"
    />
  );
}
