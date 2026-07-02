// src/proxy.js — basic server-side session gate for /workspace/**
//
// The app uses client-side Firebase Auth (see src/lib/hooks/useAuth.js) with no
// server-verified session token, so this is a presence check on the `qt_session`
// cookie (set/cleared by useAuth on auth state changes), not a verified JWT.
// Firestore security rules remain the authoritative access control layer.
import { NextResponse } from 'next/server';

export function proxy(request) {
  const hasSession = request.cookies.has('qt_session');

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/workspace/:path*'],
};
