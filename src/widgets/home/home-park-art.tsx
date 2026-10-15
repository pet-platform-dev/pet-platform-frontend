import Image from "next/image";

/** User-supplied background; meaningful copy and actions remain in HTML. */
export function HomeParkArt() {
  return (
    <div className="home-park-art" aria-hidden="true">
      <Image
        className="home-park-scenery"
        src="/images/home/hero-background.png"
        alt=""
        fill
        preload
        unoptimized
        sizes="100vw"
      />
    </div>
  );
}
