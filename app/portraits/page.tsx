import { ResponsivePhoto } from "@/components/responsive-image";
import { TransitionLink as Link } from "@/components/navigation-transition";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { portraitShowcase } from "@/content/portrait-showcase";
import { routes } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { getPortraitCollection, getPortraitCover, getPortraitPhoto, portraitCollections } from "@/lib/portraits";

export const metadata = { title: siteCopy.portraits.metadataTitle };

export default function PortraitsPage() {
  const heroPhotos = portraitShowcase.heroPhotos.map((selection) => {
    const collection = getPortraitCollection(selection.collectionSlug);
    const photo = getPortraitPhoto(selection.collectionSlug, selection.photoId);
    if (!collection || !photo) return null;
    return { ...selection, collection, photo };
  }).filter((selection) => selection !== null);

  return <main><div className="page-shell"><SiteHeader />
    <section className="portrait-editorial-hero">
      <div className="portrait-hero-collage">
        {heroPhotos.map(({ collection, layout, photo }, index) => <figure className={`portrait-hero-frame is-${layout}`} key={photo.id}>
          <ResponsivePhoto alt={siteCopy.portraits.portraitAlt(collection.title)} fetchPriority={index === 0 ? "high" : "auto"} loading={index === 0 ? "eager" : "lazy"} photo={photo} sizes="(max-width: 780px) 50vw, 33vw" />
        </figure>)}
      </div>
      <div className="portrait-hero-copy"><p className="eyebrow">{siteCopy.portraits.heroEyebrow}</p><h1>{siteCopy.portraits.heroTitle}</h1><p>{siteCopy.portraits.heroBody}</p><Link className="button button-light" href={routes.inquire}>{siteCopy.portraits.heroAction}</Link></div>
    </section>
    <section className="portrait-session-types" aria-labelledby="portrait-session-types-title">
      <div className="portrait-session-types-heading"><div><p className="eyebrow">{siteCopy.portraits.sessionTypesEyebrow}</p><h2 id="portrait-session-types-title">{siteCopy.portraits.sessionTypesTitle}</h2></div><div><p>{siteCopy.portraits.sessionTypesBody}</p><Link className="inline-link" href={routes.inquire}>{siteCopy.portraits.processAction} <span>↗</span></Link></div></div>
      <ol className="portrait-session-type-list">{siteCopy.portraits.sessionGroups.map((group) => <li key={group.number}><span>{group.number}</span><div><h3>{group.title}</h3><p className="portrait-session-kinds">{group.types}</p><p>{group.body}</p></div></li>)}</ol>
    </section>
    <section className="portrait-archive" aria-labelledby="portrait-archive-title"><div className="section-heading"><div><p className="eyebrow">{siteCopy.portraits.recentEyebrow}</p><h2 id="portrait-archive-title">{siteCopy.portraits.archiveTitle}</h2></div><p>{siteCopy.portraits.archiveBody}</p></div><div className="portrait-session-grid">{portraitCollections.map((collection) => { const cover = getPortraitCover(collection); const orientation = cover.width / cover.height > 1.15 ? "landscape" : "portrait"; return <Link className={`portrait-session-card is-${orientation}`} href={routes.portrait(collection.slug)} key={collection.slug}><div className="portrait-session-image"><ResponsivePhoto alt={siteCopy.common.coverAlt(collection.title)} photo={cover} sizes="(max-width: 780px) 100vw, 40vw" variant="768" /></div><div><h3>{collection.title}</h3><span>{siteCopy.portraits.viewSessionShort} ↗</span></div></Link>; })}</div></section>
    <section className="portrait-details"><div><p className="eyebrow">{siteCopy.portraits.processEyebrow}</p><h2>{siteCopy.portraits.processTitle}</h2><p>{siteCopy.portraits.processBody}</p><Link className="inline-link" href={routes.inquire}>{siteCopy.portraits.processAction} <span>↗</span></Link></div><div><p className="eyebrow">{siteCopy.portraits.locationEyebrow}</p><h2>{siteCopy.portraits.locationTitle}</h2><p>{siteCopy.portraits.locationBody}</p></div></section>
    <SiteFooter />
  </div></main>;
}
