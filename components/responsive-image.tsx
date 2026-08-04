/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";
import type { Photo } from "@/lib/catalog";

const photoVariantSizes = [
  ["768", 768],
  ["1600", 1600],
  ["2400", 2400],
] as const;

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "height" | "loading" | "src" | "srcSet" | "width"> & {
  alt: string;
  height: number;
  loading?: "eager" | "lazy";
  src: string;
  srcSet?: string;
  width: number;
};

export function ResponsiveImage({
  alt,
  decoding = "async",
  fetchPriority = "auto",
  height,
  loading = "lazy",
  sizes = "100vw",
  src,
  srcSet,
  width,
  ...props
}: ImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      decoding={decoding}
      fetchPriority={fetchPriority}
      height={height}
      loading={loading}
      sizes={sizes}
      src={src}
      srcSet={srcSet}
      width={width}
    />
  );
}

type PhotoVariant = "768" | "1600" | "2400";

export function buildPhotoSrcSet(photo: Pick<Photo, "height" | "variants" | "width">) {
  const longEdge = Math.max(photo.width, photo.height);
  const seenWidths = new Set<number>();

  return photoVariantSizes
    .map(([variant, targetLongEdge]) => {
      const source = photo.variants[variant];
      if (!source) return null;
      const width = Math.round((Math.min(targetLongEdge, longEdge) / longEdge) * photo.width);
      if (seenWidths.has(width)) return null;
      seenWidths.add(width);
      return `${source} ${width}w`;
    })
    .filter((source): source is string => Boolean(source))
    .join(", ");
}

export function ResponsivePhoto({
  alt,
  photo,
  srcSet,
  variant = "1600",
  ...props
}: Omit<ImageProps, "height" | "src" | "srcSet" | "width"> & {
  photo: Photo;
  srcSet?: string;
  variant?: PhotoVariant;
}) {
  const src = photo.variants[variant] ?? photo.variants["1600"];

  return (
    <ResponsiveImage
      {...props}
      alt={alt}
      height={photo.height}
      src={src}
      srcSet={srcSet ?? buildPhotoSrcSet(photo)}
      width={photo.width}
    />
  );
}

export function preloadImageSources(sources: string[]) {
  if (typeof window === "undefined") return;

  for (const source of new Set(sources)) {
    const image = new window.Image();
    image.decoding = "async";
    image.src = source;
    const decoded = image.decode?.();
    if (decoded) void decoded.catch(() => undefined);
  }
}
