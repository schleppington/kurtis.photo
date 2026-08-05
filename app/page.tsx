import { preload } from "react-dom";
import { buildPhotoSrcSet } from "@/components/responsive-image";
import { GlobeExplorer, type GlobePlace } from "@/components/globe-explorer";
import { siteConfig } from "@/content/site-config";
import { collections, getCover } from "@/lib/catalog";

export const dynamic = "force-static";

export default function Home() {
  preload("/globe/land-50m.json", { as: "fetch", fetchPriority: "high" });
  preload("/globe/countries-50m.json", { as: "fetch", fetchPriority: "high" });

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
        <GlobeExplorer places={places} />
      </div>
    </main>
  );
}
