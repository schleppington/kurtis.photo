import { preload } from "react-dom";
import { ImageFrame } from "@/components/photo-frame";
import { SiteFooter } from "@/components/site-footer";
import { siteConfig } from "@/content/site-config";
import { siteCopy } from "@/content/site-copy";

export const metadata = { title: siteCopy.about.metadataTitle };

export const dynamic = "force-static";

export default function AboutPage() {
  preload(siteConfig.aboutPhoto.src, {
    as: "image",
    fetchPriority: "high",
    imageSizes: siteConfig.aboutPhoto.sizes,
    imageSrcSet: siteConfig.aboutPhoto.srcSet,
  });

  return <main><div className="page-shell">
    <section className="about-copy"><div className="about-heading"><p className="eyebrow">{siteCopy.about.eyebrow}</p><h1>{siteCopy.about.title}</h1></div><div className="about-story">{siteCopy.about.story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></section>
    <figure className="about-photo">
      <ImageFrame
        {...siteConfig.aboutPhoto}
        alt={siteCopy.about.photoAlt}
        fetchPriority="high"
        frameClassName="about-photo-frame"
        imageClassName="about-photo-image"
        loading="eager"
      />
      <figcaption>{siteCopy.about.photoCaption}</figcaption>
    </figure>
    <section className="about-contact"><p className="eyebrow">{siteCopy.about.contactEyebrow}</p><a href={siteConfig.emailHref}>{siteConfig.email}</a><p>{siteCopy.about.instagramLabel} <span>{siteConfig.instagram}</span> <small>{siteCopy.about.instagramStatus}</small></p></section>
    <SiteFooter />
  </div></main>;
}
