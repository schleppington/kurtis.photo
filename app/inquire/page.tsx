import { InquiryForm } from "@/components/inquiry-form";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";

export const metadata = { title: siteCopy.inquiry.metadataTitle };

export const dynamic = "force-static";

export default function InquirePage() {
  return <main><div className="page-shell">
    <section className="inquiry-intro"><p className="eyebrow">{siteCopy.inquiry.eyebrow}</p><h1>{siteCopy.inquiry.title}</h1><a href={siteConfig.emailHref}>{siteCopy.inquiry.directEmail}</a></section>
    <InquiryForm />
    <SiteFooter />
  </div></main>;
}
