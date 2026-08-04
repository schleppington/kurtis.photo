"use client";

import Link, { type LinkProps } from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type PropsWithChildren,
} from "react";
import * as React from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";

export type NavigationDirection = "forward" | "back";

type ReactTransitionApi = typeof React & { addTransitionType?: (type: string) => void };
const supportsTransitionTypes = typeof (React as ReactTransitionApi).addTransitionType === "function";

type NavigationContextValue = {
  beginNavigation: (href: string, direction?: NavigationDirection) => void;
  runViewTransition: (update: () => void) => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | PromiseLike<void>) => {
    finished: Promise<unknown>;
    ready?: Promise<unknown>;
    updateCallbackDone?: Promise<unknown>;
  };
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigationTransition() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("Navigation transitions must be used inside the provider.");
  return context;
}

function isCurrentLocation(href: string) {
  const target = new URL(href, window.location.href);
  const current = new URL(window.location.href);
  return target.origin === current.origin &&
    target.pathname === current.pathname &&
    target.search === current.search &&
    target.hash === current.hash;
}

export function NavigationTransitionProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const pendingTimeoutRef = useRef<number | null>(null);
  const routeEnterTimeoutRef = useRef<number | null>(null);
  const pendingDirectionRef = useRef<NavigationDirection | null>(null);
  const hasMountedRef = useRef(false);

  const clearPendingNavigation = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  const beginNavigation = useCallback((href: string, direction: NavigationDirection = "forward") => {
    if (isCurrentLocation(href)) return;
    pendingDirectionRef.current = direction;
    setIsNavigating(true);
    document.documentElement.dataset.routeDirection = direction;
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingTimeoutRef.current = null;
      setIsNavigating(false);
    }, 1200);
  }, []);

  const runViewTransition = useCallback((update: () => void) => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const documentWithTransitions = document as ViewTransitionDocument;
    if (reducedMotion || !documentWithTransitions.startViewTransition) {
      update();
      return;
    }

    let didUpdate = false;
    const applyUpdate = () => {
      if (didUpdate) return;
      didUpdate = true;
      flushSync(update);
    };

    try {
      const transition = documentWithTransitions.startViewTransition(applyUpdate);
      void transition.finished.catch(() => undefined);
      void transition.ready?.catch(() => undefined);
      void transition.updateCallbackDone?.catch(() => undefined);
    } catch {
      applyUpdate();
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      pendingDirectionRef.current = "back";
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const isInitialRender = !hasMountedRef.current;
    hasMountedRef.current = true;
    clearPendingNavigation();
    if (isInitialRender) return;

    const root = document.documentElement;
    const direction = pendingDirectionRef.current ?? "forward";
    pendingDirectionRef.current = null;
    root.dataset.routeDirection = direction;
    root.classList.remove("route-enter");
    const frame = window.requestAnimationFrame(() => {
      setIsNavigating(false);
      root.classList.add("route-enter");
      if (routeEnterTimeoutRef.current !== null) {
        window.clearTimeout(routeEnterTimeoutRef.current);
      }
      routeEnterTimeoutRef.current = window.setTimeout(() => {
        routeEnterTimeoutRef.current = null;
        root.classList.remove("route-enter");
      }, 520);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (routeEnterTimeoutRef.current !== null) {
        window.clearTimeout(routeEnterTimeoutRef.current);
        routeEnterTimeoutRef.current = null;
      }
      root.classList.remove("route-enter");
    };
  }, [clearPendingNavigation, pathname]);

  useEffect(() => () => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }
    if (routeEnterTimeoutRef.current !== null) {
      window.clearTimeout(routeEnterTimeoutRef.current);
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ beginNavigation, runViewTransition }}>
      <div className="navigation-progress" data-state={isNavigating ? "pending" : "idle"} aria-hidden="true" />
      {children}
    </NavigationContext.Provider>
  );
}

type TransitionLinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href" | "onNavigate"> & {
    href: string;
    onNavigate?: LinkProps["onNavigate"];
    transitionDirection?: NavigationDirection;
  }
>;

type LinkNavigateEvent = Parameters<NonNullable<LinkProps["onNavigate"]>>[0];

export function TransitionLink({ href, onNavigate, transitionDirection = "forward", transitionTypes, ...props }: TransitionLinkProps) {
  const { beginNavigation } = useNavigationTransition();
  const routeTransitionTypes = transitionTypes ?? [transitionDirection === "back" ? "nav-back" : "nav-forward"];
  const nativeTransitionTypes = supportsTransitionTypes ? routeTransitionTypes : undefined;

  const handleNavigate = useCallback((event: LinkNavigateEvent) => {
    onNavigate?.(event);
    if ("defaultPrevented" in event && event.defaultPrevented) return;
    beginNavigation(href, transitionDirection);
  }, [beginNavigation, href, onNavigate, transitionDirection]);

  return (
    <Link
      {...props}
      href={href}
      onNavigate={handleNavigate}
      transitionTypes={nativeTransitionTypes}
    />
  );
}
