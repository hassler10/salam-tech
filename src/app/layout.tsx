import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Sora } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Salam Library Pro — Bibliothèque de la Mosquée Salam du Plateau",
    template: "%s · Salam Library Pro",
  },
  description:
    "Plateforme moderne de gestion des abonnés, des visiteurs et de la fréquentation — Bibliothèque de la Mosquée Salam du Plateau, Abidjan.",
  applicationName: "Salam Library Pro",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  appleWebApp: { capable: true, title: "Salam Library", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b4a2f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('slp-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
