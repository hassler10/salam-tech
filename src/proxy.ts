import { NextResponse, type NextRequest } from "next/server";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MAX_API_BODY_BYTES = 6_000_000;

export function proxy(request: NextRequest) {
  if (!MUTATING.has(request.method)) return NextResponse.next();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (!originHost || !host || originHost !== host) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
  } else if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
