import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
import { getBranding } from "@/lib/branding";
import { DEMO_MODE } from "@/lib/demo";
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
    robots: DEMO_MODE ? { index: false, follow: false } : undefined,
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
            __html: `try{if(localStorage.getItem('slp-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}try{var script=document.createElement('script');var css=window.CSS;var supported=('noModule' in script)&&!!window.Promise&&!!window.fetch&&!!(css&&css.supports&&css.supports('display','grid')&&css.supports('color','color-mix(in srgb, #000, #fff)'));if(!supported){document.documentElement.className+=' browser-incompatible'}}catch(e){document.documentElement.className+=' browser-incompatible'}`,
          }}
        />
        <style nonce={nonce}>{`
          #browser-compatibility-warning { display: none; }
          .browser-incompatible #browser-compatibility-warning {
            position: fixed; inset: 0; z-index: 2147483647; display: flex;
            align-items: center; justify-content: center; overflow: auto;
            padding: 24px; background: #f5f7f3; color: #0b1f17;
            font: 16px/1.6 Arial, sans-serif;
          }
          #browser-compatibility-warning > div {
            box-sizing: border-box; width: 100%; max-width: 560px; padding: 28px;
            border: 1px solid #d9e3dc; border-radius: 16px; background: #fff;
          }
          #browser-compatibility-warning h1 { margin: 0 0 12px; font: bold 24px/1.25 Arial, sans-serif; }
          #browser-compatibility-warning p { margin: 10px 0; }
        `}</style>
      </head>
      <body className="font-sans antialiased">
        {DEMO_MODE && (
          <div className="bg-amber-400 px-4 py-2 text-center text-[13px] font-semibold leading-snug text-amber-950">
            Mode démonstration — données fictives, aucune donnée réelle de la bibliothèque
          </div>
        )}
        <div id="browser-compatibility-warning" role="alert">
          <div>
            <h1>Ce navigateur est trop ancien</h1>
            <p>La bibliothèque utilise des technologies Web récentes qui ne sont pas prises en charge par ce navigateur.</p>
            <p>Mets à jour Microsoft Edge, Google Chrome ou Firefox, ou ouvre la plateforme depuis un téléphone récent. Internet Explorer et les anciennes versions de Microsoft Edge ne sont pas compatibles.</p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
