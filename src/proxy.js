// src/proxy.js — server-side session gate
//
// The app uses client-side Firebase Auth (see src/lib/hooks/useAuth.js) with no
// server-verified session token, so this is a presence check on the `qt_session`
// cookie (set/cleared by useAuth on auth state changes), not a verified JWT.
// Firestore security rules remain the authoritative access control layer.
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/server/firebaseAdmin';

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('qt_session')?.value;
  let hasSession = false;
  if (sessionCookie) {
    try {
      await getAdminAuth().verifySessionCookie(sessionCookie, true);
      hasSession = true;
    } catch {
      hasSession = false;
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (pathname.startsWith('/workspace') && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (sessionCookie) response.cookies.delete('qt_session');
    return response;
  }

  // Redirect authenticated users away from login page (prevents flash of login)
  if (pathname === '/login' && hasSession) {
    const workspaceUrl = new URL('/workspace', request.url);
    return NextResponse.redirect(workspaceUrl);
  }

  const response = NextResponse.next();
  if (sessionCookie && !hasSession) response.cookies.delete('qt_session');
  return response;
}

export const config = {
  matcher: ['/workspace/:path*', '/login'],
};
