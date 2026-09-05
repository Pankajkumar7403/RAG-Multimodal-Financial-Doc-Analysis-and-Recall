import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
  return (
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/") ||
    pathname.startsWith("/api/rag") ||
    pathname.startsWith("/api/workspace")
  );
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isProtectedPath(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
