import { PhotoFrame } from "@/components/photo-frame";
import { TransitionLink as Link } from "@/components/navigation-transition";
import { SiteFooter } from "@/components/site-footer";
import { routes } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { collections, getCover } from "@/lib/catalog";

export const metadata = { title: siteCopy.places.metadataTitle };

export const dynamic = "force-static";

export default function PlacesPage() {
  return (
    <main><div className="page-shell">
      <section className="page-intro places-intro">
        <p className="eyebrow">{siteCopy.places.eyebrow}</p>
        <h1>{siteCopy.places.title}</h1>
        <Link className="button button-outline" href={routes.home} transitionDirection="back">{siteCopy.places.exploreGlobe}</Link>
      </section>
      <section className="index-section" aria-labelledby="index-title">
        <div className="index-header"><p className="eyebrow">{siteCopy.places.archiveEyebrow}</p><h2 id="index-title">{siteCopy.places.archiveTitle}</h2><span>{siteCopy.places.published(collections.length)}</span></div>
        <div className="place-archive-grid">
          {collections.map((collection, index) => {
            const cover = getCover(collection);
            const ratio = cover.width / cover.height;
            const layout = ratio > 2 ? "is-panoramic" : ratio > 1.15 ? "is-landscape" : "is-portrait";
            const aspectRatio = layout === "is-panoramic" ? "2.2 / 1" : layout === "is-landscape" ? "3 / 2" : "3 / 4";
            return <Link href={routes.place(collection.slug)} className={`place-archive-card ${layout}`} key={collection.slug}>
              <PhotoFrame
                alt={siteCopy.common.coverAlt(collection.title)}
                aspectRatio={aspectRatio}
                fetchPriority={index === 0 ? "high" : "auto"}
                frameClassName="place-archive-image"
                loading={index === 0 ? "eager" : "lazy"}
                photo={cover}
                sizes="(max-width: 780px) 50vw, (max-width: 1100px) 30vw, 22vw"
                variant="768"
              />
              <div className="place-archive-copy"><h3>{collection.title}</h3><div><span>{collection.location}</span><em>{siteCopy.common.photographs(collection.images.length)}</em></div></div>
            </Link>;
          })}
        </div>
      </section>
      <SiteFooter />
    </div></main>
  );
}
