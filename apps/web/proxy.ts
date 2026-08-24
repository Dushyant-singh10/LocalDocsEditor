import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isProtected = req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/documents");
  if (isProtected && !req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*"],
};
