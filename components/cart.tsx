"use client";

import { ResponsivePhoto } from "@/components/responsive-image";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { commerceConfig, routes } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import {
  formatPrintName,
  formatPrice,
  getCollection,
  getPhoto,
  getPrintOptionForPhoto,
  getPrintOptionsForPhoto,
  type Photo,
} from "@/lib/catalog";

type CartLine = {
  id: string;
  collectionSlug: string;
  photoId: string;
  sizeId: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (line: Omit<CartLine, "id" | "quantity">) => void;
  remove: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error(siteCopy.cart.providerError);
  return context;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(commerceConfig.storageKey);
      if (saved) {
        try {
          const savedLines = JSON.parse(saved) as CartLine[];
          setLines(savedLines.filter((line) => {
            const photo = getPhoto(line.collectionSlug, line.photoId);
            return Boolean(photo && getPrintOptionForPhoto(line.collectionSlug, photo, line.sizeId));
          }));
        } catch {
          window.localStorage.removeItem(commerceConfig.storageKey);
        }
      }
      setHasLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    window.localStorage.setItem(commerceConfig.storageKey, JSON.stringify(lines));
  }, [hasLoaded, lines]);

  const clear = useCallback(() => {
    window.localStorage.removeItem(commerceConfig.storageKey);
    setLines([]);
    setOpen(false);
  }, []);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    open,
    setOpen,
    add: (line) => {
      setLines((current) => {
        const matching = current.find(
          (item) =>
            item.collectionSlug === line.collectionSlug &&
            item.photoId === line.photoId &&
            item.sizeId === line.sizeId,
        );
        if (matching) {
          return current.map((item) =>
            item.id === matching.id ? { ...item, quantity: Math.min(item.quantity + 1, commerceConfig.maxQuantity) } : item,
          );
        }
        return [...current, { ...line, id: crypto.randomUUID(), quantity: 1 }];
      });
      setOpen(true);
    },
    remove: (id) => setLines((current) => current.filter((line) => line.id !== id)),
    updateQuantity: (id, quantity) =>
      setLines((current) =>
        quantity < 1
          ? current.filter((line) => line.id !== id)
          : current.map((line) => (line.id === id ? { ...line, quantity: Math.min(quantity, commerceConfig.maxQuantity) } : line)),
      ),
    clear,
  }), [clear, lines, open]);

  return (
    <CartContext.Provider value={value}>
      <div className="app-content" inert={open}>
        {children}
      </div>
      {open ? (
        <button aria-label={`${siteCopy.cart.close} ${siteCopy.cart.label.toLowerCase()}`} className="cart-backdrop" onClick={() => setOpen(false)} tabIndex={-1} type="button" />
      ) : null}
      <CartPanel />
    </CartContext.Provider>
  );
}

export function CheckoutReturnHandler({ confirmed }: { confirmed: boolean }) {
  const { clear } = useCart();
  useEffect(() => {
    if (confirmed) clear();
  }, [clear, confirmed]);
  return null;
}

export function CartToggle() {
  const { lines, open, setOpen } = useCart();
  const totalItems = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (totalItems === 0) return null;
  return (
    <button aria-controls="shopping-cart" aria-expanded={open} className="cart-toggle" type="button" onClick={() => setOpen(true)}>
      {siteCopy.cart.toggle} <span aria-label={siteCopy.cart.itemCount(totalItems)}>· {totalItems}</span>
    </button>
  );
}

export function PrintConfigurator({ collectionSlug, photo }: { collectionSlug: string; photo: Photo }) {
  const { add } = useCart();
  const options = getPrintOptionsForPhoto(collectionSlug, photo);
  const [sizeId, setSizeId] = useState(options[0]?.id ?? "");

  if (options.length === 0) return null;

  return (
    <div className="print-configurator">
      <label htmlFor={`size-${photo.id}`}>{siteCopy.cart.printSize}</label>
      <div className="print-configurator-row">
        <select id={`size-${photo.id}`} value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} — {formatPrice(option.price)}
            </option>
          ))}
        </select>
        <button
          className="button button-ink"
          type="button"
          onClick={() => add({ collectionSlug, photoId: photo.id, sizeId })}
        >
          {siteCopy.cart.add}
        </button>
      </div>
      <p className="config-note">{siteCopy.cart.printNote}</p>
    </div>
  );
}

function CartPanel() {
  const { lines, open, setOpen, remove, updateQuantity } = useCart();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const resolvedLines = lines.flatMap((line) => {
    const collection = getCollection(line.collectionSlug);
    const photo = getPhoto(line.collectionSlug, line.photoId);
    const option = photo && getPrintOptionForPhoto(line.collectionSlug, photo, line.sizeId);
    return collection && photo && option ? [{ line, collection, photo, option }] : [];
  });
  const subtotal = resolvedLines.reduce((sum, item) => sum + item.option.price * item.line.quantity, 0);

  useEffect(() => {
    if (!open) {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
      previouslyFocusedRef.current = null;
      return;
    }

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);

  async function checkout() {
    setError(null);
    setCheckingOut(true);
    try {
      const response = await fetch(routes.checkoutApi, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? siteCopy.cart.checkoutError);
      window.location.assign(payload.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : siteCopy.cart.checkoutError);
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <aside aria-labelledby={titleId} aria-modal="true" className={`cart-panel ${open ? "is-open" : ""}`} id="shopping-cart" inert={!open} role="dialog">
      <div className="cart-panel-header">
        <div>
          <p className="eyebrow">{siteCopy.cart.eyebrow}</p>
          <h2 id={titleId}>{siteCopy.cart.title}</h2>
        </div>
        <button className="text-button" ref={closeRef} type="button" onClick={() => setOpen(false)}>{siteCopy.cart.close}</button>
      </div>
      {resolvedLines.length === 0 ? (
        <p className="empty-cart">{siteCopy.cart.empty}</p>
      ) : (
        <>
          <ul className="cart-lines">
            {resolvedLines.map(({ line, collection, photo, option }) => (
              <li key={line.id}>
                <ResponsivePhoto alt="" photo={photo} sizes="86px" variant="768" />
                <div>
                  <strong>{formatPrintName(collection, photo)}</strong>
                  <span>{option.label} · {formatPrice(option.price)}</span>
                  <div className="quantity-control">
                    <button type="button" onClick={() => updateQuantity(line.id, line.quantity - 1)} aria-label={siteCopy.cart.decrease}>−</button>
                    <span>{line.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(line.id, line.quantity + 1)} aria-label={siteCopy.cart.increase}>+</button>
                    <button className="remove-line" type="button" onClick={() => remove(line.id)}>{siteCopy.cart.remove}</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-summary"><span>{siteCopy.cart.subtotal}</span><strong>{formatPrice(subtotal)}</strong></div>
          <p className="cart-footnote">{siteCopy.cart.footnote}</p>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-ink cart-checkout" type="button" onClick={checkout} disabled={checkingOut}>
            {checkingOut ? siteCopy.cart.openingCheckout : siteCopy.cart.checkout}
          </button>
        </>
      )}
    </aside>
  );
}
