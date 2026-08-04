import { SiteFooter } from "@/components/site-footer";
import { siteCopy } from "@/content/site-copy";

export const metadata = { title: siteCopy.legal.terms.metadataTitle };

export default function TermsPage() {
  return <main><div className="page-shell"><article className="legal-copy"><p className="eyebrow">{siteCopy.legal.terms.eyebrow}</p><h1>{siteCopy.legal.terms.title}</h1>{siteCopy.legal.terms.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</article><SiteFooter /></div></main>;
}
