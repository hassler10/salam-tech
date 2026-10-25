import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
import { getBranding } from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    try {
      return new URL(explicit);
    } catch {
      // ignore les valeurs invalides et retomber sur l'URL d'hébergement
    }
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  const description =
    branding.about.length > 170 ? `${branding.about.slice(0, 167)}…` : branding.about;
  return {
    metadataBase: siteUrl(),
    title: {
      default: `${branding.shortName} — ${branding.name}`,
      template: `%s · ${branding.shortName}`,
    },
    description,
    applicationName: branding.shortName,
    manifest: "/manifest.webmanifest",
    icons: { icon: branding.logoUrl, apple: branding.logoUrl },
    appleWebApp: {
      capable: true,
      title: branding.shortName,
      statusBarStyle: "black-translucent",
    },
    openGraph: {
      title: `${branding.shortName} — ${branding.name}`,
      description: branding.tagline,
      images: [{ url: branding.coverUrl, alt: branding.name }],
      type: "website",
      locale: "fr_CI",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0b4a2f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('slp-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
