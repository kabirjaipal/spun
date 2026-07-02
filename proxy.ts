import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/setup-company", "/login", "/register"],
};

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;

  const isPublicRoute = ["/login", "/register"].includes(pathname);
  if (isPublicRoute) {
    if (request.auth?.user?.id) {
      const { user } = request.auth;
      const isOwner = user.role === "owner";
      const hasCompany = !!user.companyId;
      const dest = isOwner && !hasCompany ? "/dashboard/owner" : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!request.auth?.user?.id) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const { user } = request.auth;
  const isOwner = user.role === "owner";
  const hasCompany = !!user.companyId;

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
    if (
      !pathname.startsWith("/dashboard/owner") &&
      pathname !== "/dashboard/my-profile"
    ) {
      const allowedPages = user.allowedPages || [];
      const isAllowed = allowedPages.some((pageUrl) =>
        pathname.startsWith(pageUrl),
      );
      if (!isAllowed) {
        const fallback =
          isOwner && !hasCompany ? "/dashboard/owner" : "/dashboard";
        return NextResponse.redirect(new URL(fallback, request.nextUrl));
      }
    }
  }

  return NextResponse.next();
});
