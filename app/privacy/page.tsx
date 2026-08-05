import { SiteFooter } from "@/components/site-footer";
import { siteCopy } from "@/content/site-copy";

export const metadata = { title: siteCopy.legal.privacy.metadataTitle };

export const dynamic = "force-static";

export default function PrivacyPage() {
  return <main><div className="page-shell"><article className="legal-copy"><p className="eyebrow">{siteCopy.legal.privacy.eyebrow}</p><h1>{siteCopy.legal.privacy.title}</h1>{siteCopy.legal.privacy.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article><SiteFooter /></div></main>;
}
