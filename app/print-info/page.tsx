import { SiteFooter } from "@/components/site-footer";
import { siteCopy } from "@/content/site-copy";
import { formatPrice, printOptions } from "@/lib/catalog";

export const metadata = { title: siteCopy.printInfo.metadataTitle };

export default function PrintInfoPage() {
  return <main><div className="page-shell">
    <section className="page-intro"><p className="eyebrow">{siteCopy.printInfo.eyebrow}</p><h1>{siteCopy.printInfo.title}</h1><p>{siteCopy.printInfo.introduction}</p></section>
    <section className="print-information"><div><p className="eyebrow">{siteCopy.printInfo.pricingEyebrow}</p><h2>{siteCopy.printInfo.pricingTitle}</h2><p>{siteCopy.printInfo.pricingBody}</p><ul className="price-list">{printOptions.map((option) => <li key={option.id}><span>{option.label}</span><strong>{formatPrice(option.price)}</strong></li>)}</ul></div><div><p className="eyebrow">{siteCopy.printInfo.fulfillmentEyebrow}</p><h2>{siteCopy.printInfo.fulfillmentTitle}</h2><ul className="detail-list">{siteCopy.printInfo.fulfillmentDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul></div></section>
    <SiteFooter />
  </div></main>;
}
