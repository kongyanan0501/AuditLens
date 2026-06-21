import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 2: enable auth protection for /dashboard, /upload, /report/*
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/upload/:path*", "/report/:path*"],
};
