/* eslint-disable @next/next/no-img-element */
import { TransitionLink as Link } from "@/components/navigation-transition";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { displayDate, formatPhotoName, getCollection, getPhoto } from "@/lib/catalog";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; photoId: string }> }): Promise<Metadata> {
  const { slug, photoId } = await params;
  const collection = getCollection(slug);
  const photo = getPhoto(slug, photoId);
  if (!collection || !photo) return {};
  const title = formatPhotoName(collection, photo);
  return {
    title,
    description: siteCopy.places.photoDescription(collection.location),
    openGraph: { images: [{ url: photo.variants[siteConfig.imageVariants.display], alt: photo.alt }] },
    twitter: { card: "summary_large_image", images: [photo.variants[siteConfig.imageVariants.display]] },
  };
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string; photoId: string }> }) {
  const { slug, photoId } = await params;
  const collection = getCollection(slug);
  const photo = getPhoto(slug, photoId);
  if (!collection || !photo) notFound();
  const index = collection.images.findIndex((item) => item.id === photo.id);
  const previous = collection.images[(index - 1 + collection.images.length) % collection.images.length];
  const next = collection.images[(index + 1) % collection.images.length];
  return <main><div className="page-shell">
    <SiteHeader />
    <article className="photo-page">
      <img className="photo-page-image" src={photo.variants[siteConfig.imageVariants.full]} alt={photo.alt} />
      <div className="photo-page-details"><div><p className="eyebrow">{collection.location}</p><h1>{formatPhotoName(collection, photo)}</h1><p className="metadata-line">{[photo.metadata.cameraMake, photo.metadata.cameraBody].filter(Boolean).join(" ")}{displayDate(photo.metadata.captureDate) ? ` · ${displayDate(photo.metadata.captureDate)}` : ""}</p></div></div>
      <nav className="photo-pagination" aria-label={siteCopy.accessibility.photoNavigation}><Link href={routes.photo(collection.slug, previous.id)}>{siteCopy.common.previous}</Link><Link href={routes.place(collection.slug)}>{siteCopy.common.allPhotographs}</Link><Link href={routes.photo(collection.slug, next.id)}>{siteCopy.common.next}</Link></nav>
    </article>
    <SiteFooter />
  </div></main>;
}
