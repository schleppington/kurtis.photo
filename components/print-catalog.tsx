"use client";

import { TransitionLink as Link, useNavigationTransition } from "@/components/navigation-transition";
import { preloadImageSources, ResponsivePhoto } from "@/components/responsive-image";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PrintConfigurator } from "@/components/cart";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { formatPhotoName, type Collection, type Photo, type PrintSelection } from "@/lib/catalog";

type PrintCatalogItem = {
  photo: Photo;
  selection: PrintSelection;
};

export type PrintCatalogGroup = {
  collection: Pick<Collection, "slug" | "title">;
  items: PrintCatalogItem[];
};

export function PrintCatalog({ groups }: { groups: PrintCatalogGroup[] }) {
  const { runViewTransition } = useNavigationTransition();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"next" | "previous" | null>(null);
  const [transitionSourceKey, setTransitionSourceKey] = useState<string | null>(null);
  const catalogItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    collection: group.collection,
    key: `${group.collection.slug}-${item.photo.id}`,
  }))), [groups]);
  const itemIndexByKey = useMemo(() => new Map(catalogItems.map((item, index) => [item.key, index])), [catalogItems]);
  const activeIndexRef = useRef<number | null>(null);
  const activeItem = activeIndex === null ? null : catalogItems[activeIndex];
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null || catalogItems.length < 2) return;
    const previous = catalogItems[(activeIndex - 1 + catalogItems.length) % catalogItems.length];
    const next = catalogItems[(activeIndex + 1) % catalogItems.length];
    preloadImageSources([
      previous.photo.variants[siteConfig.imageVariants.full],
      next.photo.variants[siteConfig.imageVariants.full],
    ]);
  }, [activeIndex, catalogItems]);
  const close = useCallback(() => {
    const index = activeIndexRef.current;
    if (index === null) return;
    const item = catalogItems[index];
    flushSync(() => setTransitionSourceKey(item.key));
    runViewTransition(() => {
      setTransitionDirection(null);
      setActiveIndex(null);
    });
  }, [catalogItems, runViewTransition]);

  function open(index: number) {
    const item = catalogItems[index];
    flushSync(() => setTransitionSourceKey(item.key));
    runViewTransition(() => {
      setTransitionDirection(null);
      setActiveIndex(index);
      setTransitionSourceKey(null);
    });
  }

  function move(direction: -1 | 1) {
    const index = activeIndexRef.current;
    if (index === null) return;
    setTransitionDirection(direction === 1 ? "next" : "previous");
    setActiveIndex((index + direction + catalogItems.length) % catalogItems.length);
  }

  return (
    <>
      <section className="print-catalog" aria-label={siteCopy.prints.availableLabel}>
        {groups.map(({ collection, items }, groupIndex) => (
          <section className="print-collection" key={collection.slug}>
            <header className="print-collection-heading">
              <h2>{collection.title}</h2>
              <span>{siteCopy.prints.photoCount(items.length)}</span>
            </header>
            <div className="print-collection-grid">
              {items.map(({ selection, photo }, index) => {
                const title = selection.title ?? formatPhotoName(collection, photo);
                const itemKey = `${collection.slug}-${photo.id}`;
                const catalogIndex = itemIndexByKey.get(itemKey);
                const aspectRatio = photo.width / photo.height;
                const tileStyle = {
                  "--print-ratio": aspectRatio,
                  "--print-basis": `${aspectRatio * siteConfig.printCatalogLayout.targetRowHeight}px`,
                  "--print-max-width": `${aspectRatio * siteConfig.printCatalogLayout.maximumRowHeight}px`,
                  "--print-orphan-max-width": `${aspectRatio * siteConfig.printCatalogLayout.orphanRowHeight}px`,
                } as CSSProperties;
                return (
                  <button
                    aria-label={siteCopy.prints.enlargeLabel(title)}
                    className={activeIndex === null && transitionSourceKey === itemKey ? "print-catalog-tile is-view-transition-source" : "print-catalog-tile"}
                    key={itemKey}
                    onClick={() => {
                      if (catalogIndex !== undefined) open(catalogIndex);
                    }}
                    style={tileStyle}
                    type="button"
                  >
                    <ResponsivePhoto alt={photo.alt} loading={groupIndex === 0 && index < 3 ? "eager" : "lazy"} photo={photo} sizes="(max-width: 780px) 100vw, (max-width: 1200px) 33vw, 25vw" variant="768" />
                  </button>
                );
              })}
            </div>
            <Link className="inline-link print-collection-link" href={routes.place(collection.slug)} transitionDirection="back">{siteCopy.prints.originalCollection} <span>↗</span></Link>
          </section>
        ))}
      </section>
      {activeItem && activeIndex !== null ? (
        <PhotoLightbox
          alt={activeItem.photo.alt}
          counter={`${String(activeIndex + 1).padStart(siteConfig.countPadLength, "0")} / ${String(catalogItems.length).padStart(siteConfig.countPadLength, "0")}`}
          description={activeItem.selection.note}
          detailsAside={<PrintConfigurator collectionSlug={activeItem.collection.slug} key={activeItem.key} photo={activeItem.photo} />}
          eyebrow={activeItem.collection.title}
          onClose={close}
          onNext={() => move(1)}
          onPrevious={() => move(-1)}
          height={activeItem.photo.height}
          src={activeItem.photo.variants[siteConfig.imageVariants.full]}
          title={activeItem.selection.title ?? formatPhotoName(activeItem.collection, activeItem.photo)}
          transitionDirection={transitionDirection}
          width={activeItem.photo.width}
        >
          <nav aria-label={siteCopy.accessibility.photoNavigation} className="viewer-controls">
            <button className="viewer-step" type="button" onClick={() => move(-1)} aria-label={siteCopy.gallery.previousLabel}>{siteCopy.common.previous}</button>
            <button className="viewer-step" type="button" onClick={() => move(1)} aria-label={siteCopy.gallery.nextLabel}>{siteCopy.common.next}</button>
          </nav>
        </PhotoLightbox>
      ) : null}
    </>
  );
}
