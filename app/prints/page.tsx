import { TransitionLink as Link } from "@/components/navigation-transition";
import { CheckoutReturnHandler } from "@/components/cart";
import { PrintCatalog, type PrintCatalogGroup } from "@/components/print-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { commerceConfig, routes } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";
import { getAvailablePrints } from "@/lib/catalog";
import { isVerifiedPaidCheckout } from "@/lib/stripe";

export const metadata = { title: siteCopy.prints.metadataTitle };

export default async function PrintsPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawSessionId = query[commerceConfig.checkoutSessionQueryKey];
  const sessionId = typeof rawSessionId === "string"
    ? rawSessionId
    : null;
  const orderReceived = sessionId ? await isVerifiedPaidCheckout(sessionId) : false;
  const prints = getAvailablePrints();
  const catalogGroups = prints.reduce<PrintCatalogGroup[]>((groups, { selection, collection, photo }) => {
    let group = groups.find((candidate) => candidate.collection.slug === collection.slug);
    if (!group) {
      group = {
        collection: { slug: collection.slug, title: collection.title },
        items: [],
      };
      groups.push(group);
    }
    group.items.push({ photo, selection });
    return groups;
  }, []);

  return (
    <main><div className="page-shell">
      <SiteHeader />
      <CheckoutReturnHandler confirmed={orderReceived} />
      {orderReceived ? (
        <section className="order-confirmation" aria-live="polite">
          <p className="eyebrow">{siteCopy.prints.confirmationEyebrow}</p>
          <h1>{siteCopy.prints.confirmationTitle}</h1>
          <p className="lede">{siteCopy.prints.confirmationBody}</p>
          <Link className="button button-ink" href={routes.places}>{siteCopy.prints.confirmationAction}</Link>
        </section>
      ) : sessionId ? (
        <section className="order-confirmation" aria-live="polite">
          <p className="eyebrow">{siteCopy.prints.verificationEyebrow}</p>
          <h1>{siteCopy.prints.verificationTitle}</h1>
          <p className="lede">{siteCopy.prints.verificationBody}</p>
          <Link className="button button-ink" href={routes.prints}>{siteCopy.cart.close}</Link>
        </section>
      ) : (
        <section className="page-intro print-intro">
          <p className="eyebrow">{siteCopy.prints.eyebrow}</p>
          <h1>{siteCopy.prints.title}</h1>
          <p>{siteCopy.prints.introduction}</p>
        </section>
      )}
      {prints.length === 0 ? (
        <section className="print-empty">
          <p className="eyebrow">{siteCopy.prints.emptyEyebrow}</p>
          <h2>{siteCopy.prints.emptyTitle}</h2>
          <p>{siteCopy.prints.emptyBody}</p>
          <Link className="inline-link" href={routes.places}>{siteCopy.prints.emptyAction} <span>↗</span></Link>
        </section>
      ) : (
        <PrintCatalog groups={catalogGroups} />
      )}
      <SiteFooter />
    </div></main>
  );
}
