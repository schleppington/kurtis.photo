"use client";

import { ResponsiveImage } from "@/components/responsive-image";
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { siteCopy } from "@/content/site-copy";

export function PhotoLightbox({
  alt,
  children,
  counter,
  description,
  detailsAside,
  eyebrow,
  height,
  metadata,
  onClose,
  onNext,
  onPrevious,
  src,
  title,
  transitionDirection,
  width,
}: {
  alt: string;
  children?: ReactNode;
  counter?: string;
  description?: ReactNode;
  detailsAside?: ReactNode;
  eyebrow?: string;
  height: number;
  metadata?: ReactNode;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  src: string;
  title: string;
  transitionDirection?: "next" | "previous" | null;
  width: number;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const beginClose = useCallback(() => setClosing(true), []);
  const setDialogRef = useCallback((dialog: HTMLDialogElement | null) => {
    dialogRef.current = dialog;
    if (!dialog || dialog.open) return;
    try {
      dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    if (dialog) {
      try {
        if (!dialog.open) dialog.showModal();
      } catch {
        dialog.setAttribute("open", "");
      }
    }
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog?.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (closing) return;
      if (event.key === "Escape") beginClose();
      if (event.key === "ArrowLeft") onPrevious?.();
      if (event.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [beginClose, closing, onNext, onPrevious]);

  const directionClass = transitionDirection ? ` is-${transitionDirection}` : "";

  return (
    <dialog
      aria-labelledby={titleId}
      aria-modal="true"
      className={`photo-viewer${closing ? " is-closing" : ""}`}
      onCancel={(event) => { event.preventDefault(); beginClose(); }}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget && event.animationName === "viewer-backdrop-out") onClose();
      }}
      onMouseDown={(event) => {
        if (!closing && event.target === event.currentTarget) beginClose();
      }}
      ref={setDialogRef}
    >
      <div className="viewer-topbar">
        <span>{counter}</span>
        <button className="text-button" onClick={beginClose} ref={closeRef} type="button">{siteCopy.gallery.close}</button>
      </div>
      <div className="viewer-main">
        <ResponsiveImage alt={alt} className={`viewer-photo${directionClass}`} fetchPriority="high" height={height} key={src} loading="eager" src={src} width={width} />
      </div>
      {children}
      <div className={`viewer-details${detailsAside ? " has-aside" : ""}`}>
        <div className={`viewer-details-content${directionClass}`} key={src}>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={titleId}>{title}</h2>
          {metadata ? <p className="metadata-line">{metadata}</p> : null}
          {description ? <p className="viewer-description">{description}</p> : null}
        </div>
        {detailsAside ? <aside className="viewer-details-aside">{detailsAside}</aside> : null}
      </div>
    </dialog>
  );
}
