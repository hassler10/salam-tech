import { NextResponse } from "next/server";
import { loadBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await loadBranding();
  const customLogo = branding.logoUrl.startsWith("/api/branding/");
  const iconSize = customLogo ? "512x512" : "1024x1024";

  const manifest = {
    name: branding.name,
    short_name: branding.shortName,
    description: branding.tagline,
    lang: "fr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f9f5",
    theme_color: "#0b4a2f",
    icons: [
      { src: branding.logoUrl, sizes: iconSize, type: "image/png", purpose: "any" },
      { src: branding.logoUrl, sizes: iconSize, type: "image/png", purpose: "maskable" },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
