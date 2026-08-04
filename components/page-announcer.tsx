"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function PageAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const title = document.title.replace(/\s+\u2014\s+kurtis\.photo$/i, "");
      setAnnouncement(title ? `${title} page` : "Page loaded");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <p className="visually-hidden" aria-atomic="true" aria-live="polite">{announcement}</p>;
}
