"use client";

import { TransitionLink as Link } from "@/components/navigation-transition";
import { CartToggle } from "@/components/cart";
import { navigation, routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { usePathname } from "next/navigation";

function isActiveRoute(href: string, pathname: string) {
  if (href === routes.home) return pathname === routes.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="wordmark" href={routes.home} transitionDirection="back" aria-label={siteCopy.accessibility.home}>
        {siteConfig.brandName.split(".")[0]}<span>.</span>{siteConfig.brandName.split(".")[1]}
      </Link>
      <nav aria-label={siteCopy.accessibility.primaryNavigation}>
        {navigation.map((item) => <Link aria-current={isActiveRoute(item.href, pathname) ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <CartToggle />
    </header>
  );
}
