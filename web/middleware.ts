import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = new Set([
  '/login',
  '/favicon.ico',
  '/api/auth/[...nextauth]',
  '/api/ocr',
  '/api/ocr-stream',
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Protect all app routes (chat etc.)
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only for settings
  if (pathname.startsWith('/settings') && (token as any).role !== 'Admin') {
    return NextResponse.rewrite(new URL('/?error=forbidden', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};


