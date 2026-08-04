import { TransitionLink as Link } from "@/components/navigation-transition";
import { routes, siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>{siteCopy.footer.copyright(new Date().getFullYear())}</p>
      <div>
        <a href={siteConfig.emailHref}>{siteConfig.email}</a>
        <Link href={routes.privacy}>{siteCopy.footer.privacy}</Link>
        <Link href={routes.terms}>{siteCopy.footer.terms}</Link>
      </div>
    </footer>
  );
}
