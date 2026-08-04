import { TransitionLink as Link } from "@/components/navigation-transition";
import { CartToggle } from "@/components/cart";
import { navigation, routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href={routes.home} aria-label={siteCopy.accessibility.home}>
        {siteConfig.brandName.split(".")[0]}<span>.</span>{siteConfig.brandName.split(".")[1]}
      </Link>
      <nav aria-label={siteCopy.accessibility.primaryNavigation}>
        {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <CartToggle />
    </header>
  );
}
