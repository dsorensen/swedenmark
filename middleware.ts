import { type NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    // Run on every path except Next.js internals and the public folder.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|txt)$).*)",
  ],
};

export function middleware(req: NextRequest) {
  const password = process.env.DEMO_BASIC_AUTH_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.DEMO_BASIC_AUTH_USER ?? "demo";
  const expected = `Basic ${btoa(`${user}:${password}`)}`;
  const provided = req.headers.get("authorization") ?? "";

  if (timingSafeEqual(provided, expected)) return NextResponse.next();

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="swedenmark", charset="UTF-8"' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
