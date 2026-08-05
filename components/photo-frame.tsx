'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { useCallback, useState } from 'react';
import { ResponsiveImage, ResponsivePhoto } from '@/components/responsive-image';

type FrameImageProps = Omit<
  ComponentProps<typeof ResponsiveImage>,
  'className' | 'style' | 'onLoad' | 'onError'
> & {
  aspectRatio?: CSSProperties['aspectRatio'];
  frameClassName?: string;
  frameStyle?: CSSProperties;
  imageClassName?: string;
  placeholderColor?: string | null;
};

type PhotoFrameProps = Omit<
  ComponentProps<typeof ResponsivePhoto>,
  'className' | 'style' | 'onLoad' | 'onError'
> & {
  aspectRatio?: CSSProperties['aspectRatio'];
  frameClassName?: string;
  frameStyle?: CSSProperties;
  imageClassName?: string;
  placeholderColor?: string | null;
};

function useImageLoadState(source: string) {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    if (node?.querySelector('img')?.complete) {
      setLoadedSource(source);
    }
  }, [source]);
  const markLoaded = useCallback(() => setLoadedSource(source), [source]);

  return { frameRef, loaded: loadedSource === source, markLoaded };
}

function frameStyle(
  aspectRatio: CSSProperties['aspectRatio'] | undefined,
  placeholderColor: string | null | undefined,
  style: CSSProperties | undefined,
  width: number,
  height: number,
) {
  return {
    ...style,
    aspectRatio: aspectRatio ?? `${width} / ${height}`,
    ...(placeholderColor ? { '--photo-placeholder-color': placeholderColor } : {}),
  } as CSSProperties;
}

function frameClassName(className: string | undefined, loaded: boolean) {
  return ['photo-frame', className, loaded ? 'is-loaded' : ''].filter(Boolean).join(' ');
}

export function ImageFrame({
  alt,
  aspectRatio,
  frameClassName: className,
  frameStyle: style,
  imageClassName,
  placeholderColor,
  ...props
}: FrameImageProps) {
  const { frameRef, loaded, markLoaded } = useImageLoadState(props.src);

  return (
    <div
      className={frameClassName(className, loaded)}
      data-image-state={loaded ? 'loaded' : 'loading'}
      ref={frameRef}
      style={frameStyle(aspectRatio, placeholderColor, style, props.width, props.height)}
    >
      <ResponsiveImage
        {...props}
        alt={alt}
        className={['photo-frame-image', imageClassName].filter(Boolean).join(' ')}
        onError={markLoaded}
        onLoad={markLoaded}
      />
    </div>
  );
}

export function PhotoFrame({
  alt,
  aspectRatio,
  frameClassName: className,
  frameStyle: style,
  imageClassName,
  photo,
  placeholderColor,
  variant = '768',
  ...props
}: PhotoFrameProps) {
  const source = photo.variants[variant] ?? photo.variants['1600'];
  const { frameRef, loaded, markLoaded } = useImageLoadState(source);

  return (
    <div
      className={frameClassName(className, loaded)}
      data-image-state={loaded ? 'loaded' : 'loading'}
      ref={frameRef}
      style={frameStyle(aspectRatio, placeholderColor ?? photo.placeholderColor, style, photo.width, photo.height)}
    >
      <ResponsivePhoto
        {...props}
        alt={alt}
        className={['photo-frame-image', imageClassName].filter(Boolean).join(' ')}
        onError={markLoaded}
        onLoad={markLoaded}
        photo={photo}
        variant={variant}
      />
    </div>
  );
}
