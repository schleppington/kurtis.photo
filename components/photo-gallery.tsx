"use client";

import { flushSync } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigationTransition } from "@/components/navigation-transition";
import { PhotoFrame } from "@/components/photo-frame";
import { preloadImageSources } from "@/components/responsive-image";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { displayDate, formatPhotoName, type Collection } from "@/lib/catalog";

type GalleryCollection = Pick<Collection, "slug" | "title" | "images"> & { location?: string };


export function PhotoGallery({
  collection,
  basePath = routes.places,
  showMetadata = true,
}: {
  collection: GalleryCollection;
  basePath?: string;
  showMetadata?: boolean;
}) {
  const { runViewTransition } = useNavigationTransition();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<"next" | "previous" | null>(null);
  const [transitionSourceId, setTransitionSourceId] = useState<string | null>(null);
  const activeIndexRef = useRef<number | null>(null);
  const activePhoto = activeIndex === null ? null : collection.images[activeIndex];
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null || collection.images.length < 2) return;
    const previous = collection.images[(activeIndex - 1 + collection.images.length) % collection.images.length];
    const next = collection.images[(activeIndex + 1) % collection.images.length];
    preloadImageSources([
      previous.variants[siteConfig.imageVariants.full],
      next.variants[siteConfig.imageVariants.full],
    ]);
  }, [activeIndex, collection.images]);

  useEffect(() => {
    const onPopState = () => {
      const index = activeIndexRef.current;
      if (index === null) return;
      flushSync(() => setTransitionSourceId(collection.images[index].id));
      runViewTransition(() => {
        setTransitionDirection(null);
        setActiveIndex(null);
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [collection.images, runViewTransition]);

  function open(index: number) {
    const photo = collection.images[index];
    preloadImageSources([photo.variants[siteConfig.imageVariants.full]]);
    flushSync(() => setTransitionSourceId(photo.id));
    runViewTransition(() => {
      window.history.pushState({}, "", `${basePath}/${collection.slug}/${photo.id}`);
      setTransitionDirection(null);
      setActiveIndex(index);
      setTransitionSourceId(null);
    });
  }

  const close = useCallback(() => {
    const index = activeIndexRef.current;
    if (index === null) return;
    const photo = collection.images[index];
    flushSync(() => setTransitionSourceId(photo.id));
    runViewTransition(() => {
      window.history.replaceState({}, "", `${basePath}/${collection.slug}`);
      setTransitionDirection(null);
      setActiveIndex(null);
    });
  }, [basePath, collection.images, collection.slug, runViewTransition]);

  function move(direction: -1 | 1) {
    const index = activeIndexRef.current;
    if (index === null) return;
    const nextIndex = (index + direction + collection.images.length) % collection.images.length;
    window.history.replaceState({}, "", `${basePath}/${collection.slug}/${collection.images[nextIndex].id}`);
    setTransitionDirection(direction === 1 ? "next" : "previous");
    setActiveIndex(nextIndex);
  }

  return (
    <>
      <div className="photo-grid">
        {collection.images.map((photo, index) => (
          <button className="photo-tile" key={photo.id} type="button" onClick={() => open(index)}>
            <PhotoFrame
              alt={photo.alt}
              aspectRatio={photo.width + " / " + photo.height}
              fetchPriority={index === 0 ? "high" : "auto"}
              frameClassName={"photo-tile-media" + (activeIndex === null && transitionSourceId === photo.id ? " is-view-transition-source" : "")}
              loading={index > 1 ? "lazy" : "eager"}
              photo={photo}
              sizes="(max-width: 780px) 100vw, (max-width: 1150px) 33vw, 25vw"
              variant="768"
            />
            <span>{formatPhotoName(collection, photo)}</span>
          </button>
        ))}
      </div>
      {activePhoto && activeIndex !== null ? (
        <PhotoLightbox
          alt={activePhoto.alt}
          counter={`${String(activeIndex + 1).padStart(siteConfig.countPadLength, "0")} / ${String(collection.images.length).padStart(siteConfig.countPadLength, "0")}`}
          eyebrow={showMetadata ? collection.location : undefined}
          metadata={showMetadata ? <>
            {[activePhoto.metadata.cameraMake, activePhoto.metadata.cameraBody].filter(Boolean).join(" ")}
            {displayDate(activePhoto.metadata.captureDate) ? ` · ${displayDate(activePhoto.metadata.captureDate)}` : ""}
          </> : undefined}
          onClose={close}
          onNext={() => move(1)}
          onPrevious={() => move(-1)}
          height={activePhoto.height}
          src={activePhoto.variants[siteConfig.imageVariants.full]}
          title={formatPhotoName(collection, activePhoto)}
          transitionDirection={transitionDirection}
          width={activePhoto.width}
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
