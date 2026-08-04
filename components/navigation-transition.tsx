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
import { usePathname, useRouter } from "next/navigation";

type NavigationContextValue = {
  beginNavigation: (href: string) => void;
  runTransition: (update: () => void) => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
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
  const hasMountedRef = useRef(false);

  const clearPendingNavigation = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  const beginNavigation = useCallback((href: string) => {
    if (isCurrentLocation(href)) return;
    setIsNavigating(true);
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }
    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingTimeoutRef.current = null;
      setIsNavigating(false);
    }, 1500);
  }, []);

  const runTransition = useCallback((update: () => void) => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const documentWithTransitions = document as ViewTransitionDocument;
    if (reducedMotion || !documentWithTransitions.startViewTransition) {
      update();
      return;
    }

    try {
      const transition = documentWithTransitions.startViewTransition(update);
      void transition.finished.catch(() => undefined);
      void transition.ready?.catch(() => undefined);
      void transition.updateCallbackDone?.catch(() => undefined);
    } catch {
      update();
    }
  }, []);

  useEffect(() => {
    const isInitialRender = !hasMountedRef.current;
    hasMountedRef.current = true;
    clearPendingNavigation();
    if (isInitialRender) return;

    const root = document.documentElement;
    root.classList.remove("route-enter");
    const frame = window.requestAnimationFrame(() => {
      setIsNavigating(false);
      root.classList.add("route-enter");
      window.setTimeout(() => root.classList.remove("route-enter"), 520);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      root.classList.remove("route-enter");
    };
  }, [clearPendingNavigation, pathname]);

  useEffect(() => () => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }
  }, []);

  return (
    <NavigationContext.Provider value={{ beginNavigation, runTransition }}>
      <div className="navigation-progress" data-state={isNavigating ? "pending" : "idle"} aria-hidden="true" />
      {children}
    </NavigationContext.Provider>
  );
}

type TransitionLinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href" | "onNavigate"> & { href: string }
>;

export function TransitionLink({ href, onClick, target, ...props }: TransitionLinkProps) {
  const { beginNavigation, runTransition } = useNavigationTransition();
  const router = useRouter();

  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== "_self")
    ) return;

    const targetUrl = new URL(href, window.location.href);
    if (targetUrl.origin !== window.location.origin || isCurrentLocation(href)) return;
    event.preventDefault();
    beginNavigation(href);
    runTransition(() => router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`));
  }, [beginNavigation, href, onClick, router, runTransition, target]);

  return (
    <Link
      {...props}
      href={href}
      onClick={handleClick}
      target={target}
    />
  );
}
