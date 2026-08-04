import { buildPhotoSrcSet } from "@/components/responsive-image";
import { GlobeExplorer, type GlobePlace } from "@/components/globe-explorer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/content/site-config";
import { collections, getCover } from "@/lib/catalog";

export default function Home() {
  const places: GlobePlace[] = collections.map((collection) => {
    const cover = getCover(collection);
    return {
      slug: collection.slug,
      title: collection.title,
      location: collection.location,
      note: collection.note,
      photoCount: collection.images.length,
      coordinates: collection.coordinates,
      cover: {
        src: cover.variants[siteConfig.imageVariants.thumbnail],
        srcSet: buildPhotoSrcSet(cover),
        alt: cover.alt,
        width: cover.width,
        height: cover.height,
      },
    };
  });

  return (
    <main className="globe-home">
      <div className="globe-home-shell">
        <SiteHeader />
        <GlobeExplorer places={places} />
      </div>
    </main>
  );
}
