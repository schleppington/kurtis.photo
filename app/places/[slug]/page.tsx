import { preload } from "react-dom";
import { buildPhotoSrcSet } from "@/components/responsive-image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TransitionLink as Link } from "@/components/navigation-transition";
import { PhotoGallery } from "@/components/photo-gallery";
import { SiteFooter } from "@/components/site-footer";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { collections, getCollection, getCover } from "@/lib/catalog";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return {};
  const cover = getCover(collection);
  return {
    title: collection.title,
    description: collection.note ?? siteCopy.places.metadataDescription(collection.location),
    openGraph: { images: [{ url: cover.variants[siteConfig.imageVariants.display], alt: cover.alt }] },
    twitter: { card: "summary_large_image", images: [cover.variants[siteConfig.imageVariants.display]] },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();
  const firstPhoto = collection.images[0];
  preload(firstPhoto.variants[siteConfig.imageVariants.thumbnail], {
    as: "image",
    fetchPriority: "high",
    imageSizes: "(max-width: 780px) 100vw, (max-width: 1150px) 33vw, 25vw",
    imageSrcSet: buildPhotoSrcSet(firstPhoto),
  });
  return (
    <main><div className="page-shell">
      <section className="collection-intro">
        <div><p className="eyebrow">{collection.location}</p><h1>{collection.title}</h1></div>
        <p>{collection.note ?? siteCopy.places.collectionFallback(collection.location)}</p>
      </section>
      <div className="collection-map-memory">
        <Link className="inline-link" href={`${routes.home}?place=${encodeURIComponent(collection.slug)}`} transitionDirection="back">{siteCopy.places.showOnGlobe} <span>↗</span></Link>
      </div>
      <PhotoGallery collection={collection} />
      <SiteFooter />
    </div></main>
  );
}
