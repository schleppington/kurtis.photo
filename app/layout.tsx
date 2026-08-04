import type { Metadata } from "next";
import Script from "next/script";
import { CartProvider } from "@/components/cart";
import { siteConfig } from "@/content/site-config";
import { NavigationTransitionProvider } from "@/components/navigation-transition";
import { siteCopy } from "@/content/site-copy";
import "maplibre-gl/dist/maplibre-gl.css";
import "./theme.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.canonicalOrigin),
  title: { default: siteConfig.brandName, template: `%s — ${siteConfig.brandName}` },
  description: siteCopy.metadata.description,
  icons: { icon: [...siteConfig.icons] },
  openGraph: {
    title: siteConfig.brandName,
    description: siteCopy.metadata.socialDescription,
    type: "website",
    images: [{ ...siteConfig.socialImage, alt: siteCopy.metadata.socialImageAlt }],
  },
  twitter: { card: "summary_large_image", images: [siteConfig.socialImage.url] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={siteConfig.language}>
      <body>
        <NavigationTransitionProvider>
          <CartProvider>{children}</CartProvider>
        </NavigationTransitionProvider>
        {process.env.CF_ANALYTICS_TOKEN ? (
          <Script
            data-cf-beacon={JSON.stringify({ token: process.env.CF_ANALYTICS_TOKEN })}
            src={siteConfig.analytics.scriptUrl}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
