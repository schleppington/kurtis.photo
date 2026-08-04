import { ResponsivePhoto } from "@/components/responsive-image";
import { TransitionLink as Link } from "@/components/navigation-transition";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routes } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { formatPhotoName } from "@/lib/catalog";
import { getPortraitCollection, getPortraitPhoto, portraitCollections } from "@/lib/portraits";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return portraitCollections.flatMap((collection) => collection.images.map((photo) => ({
    slug: collection.slug,
    photoId: photo.id,
  })));
}

export default async function PortraitPhotoPage({ params }: { params: Promise<{ slug: string; photoId: string }> }) {
  const { slug, photoId } = await params;
  const collection = getPortraitCollection(slug);
  const photo = getPortraitPhoto(slug, photoId);
  if (!collection || !photo) notFound();

  const index = collection.images.findIndex((image) => image.id === photo.id);
  const previous = collection.images[(index - 1 + collection.images.length) % collection.images.length];
  const next = collection.images[(index + 1) % collection.images.length];

  return <main><div className="page-shell"><SiteHeader />
    <section className="photo-page portrait-photo-page"><Link className="inline-link" href={routes.portrait(collection.slug)}>{siteCopy.portraits.backTo(collection.title)}</Link><ResponsivePhoto alt={photo.alt} className="photo-page-image" fetchPriority="high" loading="eager" photo={photo} sizes="(max-width: 780px) calc(100vw - 32px), min(1500px, calc(100vw - 64px))" variant="2400" /><div className="photo-page-details"><div><p className="eyebrow">{siteCopy.portraits.sessionEyebrow}</p><h1>{formatPhotoName(collection, photo)}</h1></div></div><nav className="photo-pagination" aria-label={siteCopy.accessibility.photoNavigation}><Link href={routes.portraitPhoto(collection.slug, previous.id)}>{siteCopy.common.previous}</Link><Link href={routes.portrait(collection.slug)}>{siteCopy.common.allPhotographs}</Link><Link href={routes.portraitPhoto(collection.slug, next.id)}>{siteCopy.common.next}</Link></nav></section>
    <SiteFooter />
  </div></main>;
}
