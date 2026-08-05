import type { CSSProperties } from 'react';

type RouteLoadingVariant = 'archive' | 'gallery' | 'portraits' | 'prints';

const placeholderCounts: Record<RouteLoadingVariant, number> = {
  archive: 9,
  gallery: 12,
  portraits: 8,
  prints: 12,
};

function placeholderRatio(variant: RouteLoadingVariant, index: number) {
  if (variant === 'gallery') {
    return index % 4 === 0 ? '4 / 5' : index % 3 === 0 ? '3 / 2' : '1 / 1';
  }
  if (variant === 'portraits') {
    return index === 0 ? '4 / 5' : index % 2 === 0 ? '3 / 2' : '1 / 1';
  }
  if (variant === 'prints') return index % 3 === 0 ? '3 / 2' : '1 / 1';
  return index % 3 === 0 ? '2.2 / 1' : index % 2 === 0 ? '3 / 2' : '3 / 4';
}

export function RouteLoading({ variant = 'archive' }: { variant?: RouteLoadingVariant }) {
  const count = placeholderCounts[variant];

  return (
    <main className={`route-loading route-loading-${variant}`} aria-busy="true" aria-live="polite">
      <div className="page-shell">
        <section className="route-loading-intro" aria-hidden="true">
          <span className="route-loading-kicker" />
          <span className="route-loading-title" />
          <span className="route-loading-copy" />
        </section>
        <div className={`route-loading-grid is-${variant}`} aria-hidden="true">
          {Array.from({ length: count }, (_, index) => (
            <span
              key={index}
              style={{ '--loading-ratio': placeholderRatio(variant, index) } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
