import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/setup-company",
    "/login",
    "/register",
  ],
};

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const { pathname } = request.nextUrl;

  const isPublicRoute = ["/login", "/register"].includes(pathname);
  if (isPublicRoute) return NextResponse.next();

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  const isOwner = token.role === "owner";
  const hasCompany = !!token.companyId;

  // Non-owners without a company must set one up first
  if (!isOwner && !hasCompany && pathname !== "/setup-company") {
    return NextResponse.redirect(new URL("/setup-company", request.nextUrl));
  }

  // Redirect away from setup-company once the user has a context
  if ((isOwner || hasCompany) && pathname === "/setup-company") {
    const dest = isOwner && !hasCompany ? "/dashboard/owner" : "/dashboard";
    return NextResponse.redirect(new URL(dest, request.nextUrl));
  }

  // /dashboard/owner is only for owners
  if (pathname.startsWith("/dashboard/owner") && !isOwner) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  // /dashboard (non-owner sub-pages) require page-level authorization
  if (pathname.startsWith("/dashboard/")) {
    // skip the owner sub-section and core profile page
    if (!pathname.startsWith("/dashboard/owner") && pathname !== "/dashboard/my-profile") {
      const allowedPages = (token.allowedPages as string[]) || [];
      const isAllowed = allowedPages.some((pageUrl) => pathname.startsWith(pageUrl));
      if (!isAllowed) {
        const fallback = isOwner && !hasCompany ? "/dashboard/owner" : "/dashboard";
        return NextResponse.redirect(new URL(fallback, request.nextUrl));
      }
    }
  }

  return NextResponse.next();
}
