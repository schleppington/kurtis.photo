/* eslint-disable @next/next/no-img-element */
import { TransitionLink as Link } from "@/components/navigation-transition";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { collections, getCover } from "@/lib/catalog";

export const metadata = { title: siteCopy.places.metadataTitle };

export default function PlacesPage() {
  return (
    <main><div className="page-shell">
      <SiteHeader />
      <section className="page-intro places-intro">
        <p className="eyebrow">{siteCopy.places.eyebrow}</p>
        <h1>{siteCopy.places.title}</h1>
        <Link className="button button-outline" href={routes.home}>{siteCopy.places.exploreGlobe}</Link>
      </section>
      <section className="index-section" aria-labelledby="index-title">
        <div className="index-header"><p className="eyebrow">{siteCopy.places.archiveEyebrow}</p><h2 id="index-title">{siteCopy.places.archiveTitle}</h2><span>{siteCopy.places.published(collections.length)}</span></div>
        <div className="place-archive-grid">
          {collections.map((collection) => {
            const cover = getCover(collection);
            const ratio = cover.width / cover.height;
            const layout = ratio > 2 ? "is-panoramic" : ratio > 1.15 ? "is-landscape" : "is-portrait";
            return <Link href={routes.place(collection.slug)} className={`place-archive-card ${layout}`} key={collection.slug}>
              <div className="place-archive-image"><img src={cover.variants[siteConfig.imageVariants.thumbnail]} alt={siteCopy.common.coverAlt(collection.title)} /></div>
              <div className="place-archive-copy"><h3>{collection.title}</h3><div><span>{collection.location}</span><em>{siteCopy.common.photographs(collection.images.length)}</em></div></div>
            </Link>;
          })}
        </div>
      </section>
      <SiteFooter />
    </div></main>
  );
}
