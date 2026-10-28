import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { DEMO_MODE } from "@/lib/demo";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Appel serveur à serveur authentifié par HMAC et horodatage, sans cookie de session :
// le contrôle d'origine s'applique uniquement aux requêtes déclenchées par un navigateur.
const SIGNATURE_AUTHENTICATED = new Set(["/api/webhooks/media-salam"]);
const MAX_API_BODY_BYTES = 6_000_000;
const CSP_EXCLUDED = ["_next/static", "_next/image", "favicon.ico", "sw.js", "manifest.webmanifest"];

function applyDemoHeaders<T extends NextResponse>(response: T): T {
  if (DEMO_MODE) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (isApi && MUTATING.has(request.method) && !SIGNATURE_AUTHENTICATED.has(request.nextUrl.pathname)) {
    const contentLengthHeader = request.headers.get("content-length");
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (
      contentLengthHeader !== null &&
      (contentLength === null || !Number.isSafeInteger(contentLength) || contentLength < 0)
    ) {
      return NextResponse.json({ error: "Longueur de requête invalide." }, { status: 400 });
    }
    if (contentLength !== null && contentLength > MAX_API_BODY_BYTES) {
      return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    }
    if (contentLengthHeader === null && request.headers.get("transfer-encoding") !== null) {
      return NextResponse.json({ error: "Longueur de requête requise." }, { status: 411 });
    }

    const host = request.headers.get("host");
    const source = request.headers.get("origin") ?? request.headers.get("referer");
    let sourceHost: string | null = null;
    try {
      sourceHost = source ? new URL(source).host : null;
    } catch {
      sourceHost = null;
    }
    if (!sourceHost || !host || sourceHost !== host) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
  }

  if (isApi || CSP_EXCLUDED.some((prefix) => request.nextUrl.pathname.startsWith(`/${prefix}`))) {
    return applyDemoHeaders(NextResponse.next());
  }

  const nonce = Buffer.from(randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return applyDemoHeaders(response);
}

export const config = {
  matcher: [
    "/api/:path*",
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
