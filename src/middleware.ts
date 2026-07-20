import { NextRequest, NextResponse } from "next/server";

function isAuthorized(request: NextRequest, password: string): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return false;
  }

  const encoded = authHeader.slice("Basic ".length);
  try {
    const decoded = atob(encoded);
    const colon = decoded.indexOf(":");
    const suppliedPassword = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    return suppliedPassword === password;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/cron/run")) {
    return NextResponse.next();
  }

  if (isAuthorized(request, password)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Drive Time Tracker"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
