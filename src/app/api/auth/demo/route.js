import { NextResponse } from 'next/server';

export async function GET(request) {
  // 1. Create a redirect response to /workspace
  const url = request.nextUrl.clone();
  url.pathname = '/workspace';
  url.search = '';
  const response = NextResponse.redirect(url);

  // 2. Set a secure cookie to tell the client we want to demo login
  // We don't use httpOnly so the client-side Firebase hook can read it and authenticate
  response.cookies.set('qt_demo_login', '1', {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60, // valid for 1 minute
  });

  return response;
}
