import { preload } from "react-dom";
import { buildPhotoSrcSet } from "@/components/responsive-image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoGallery } from "@/components/photo-gallery";
import { SiteFooter } from "@/components/site-footer";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { getPortraitCollection, getPortraitCover, portraitCollections } from "@/lib/portraits";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return portraitCollections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = getPortraitCollection(slug);
  if (!collection) return {};
  const cover = getPortraitCover(collection);
  return {
    title: collection.title,
    description: collection.note ?? siteCopy.portraits.metadataDescription,
    openGraph: { images: [{ url: cover.variants[siteConfig.imageVariants.display], alt: cover.alt }] },
    twitter: { card: "summary_large_image", images: [cover.variants[siteConfig.imageVariants.display]] },
  };
}

export default async function PortraitCollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getPortraitCollection(slug);
  if (!collection) notFound();
  const firstPhoto = collection.images[0];
  preload(firstPhoto.variants["768"], {
    as: "image",
    fetchPriority: "high",
    imageSizes: "(max-width: 780px) 100vw, (max-width: 1150px) 33vw, 25vw",
    imageSrcSet: buildPhotoSrcSet(firstPhoto),
  });

  return <main><div className="page-shell">
    <section className="collection-intro portrait-collection-intro"><div><p className="eyebrow">{siteCopy.portraits.sessionEyebrow}</p><h1>{collection.title}</h1></div><p>{collection.note ?? siteCopy.portraits.sessionFallback}</p></section>
    <PhotoGallery collection={collection} basePath={routes.portraits} showMetadata={false} />
    <SiteFooter />
  </div></main>;
}
