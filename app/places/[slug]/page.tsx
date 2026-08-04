import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoGallery } from "@/components/photo-gallery";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/content/site-config";
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
  return (
    <main><div className="page-shell">
      <section className="collection-intro">
        <div><p className="eyebrow">{collection.location}</p><h1>{collection.title}</h1></div>
        <p>{collection.note ?? siteCopy.places.collectionFallback(collection.location)}</p>
      </section>
      <PhotoGallery collection={collection} />
      <SiteFooter />
    </div></main>
  );
}
