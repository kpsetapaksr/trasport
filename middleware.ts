import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes that require NO authentication (public)
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/seed',
  '/api/auth/unlock-test',       // test-only account unlock (disabled in production by the route itself)
  '/api/auth/sync-indexes-test', // test-only index sync (disabled in production by the route itself)
  '/api/driver/auth',
  // Patient-facing endpoints
  '/api/transport/check-appointment',
  '/api/transport/available-slots',
  '/api/transport/requests',
  '/api/transport/request',
  '/api/transport/rebook',
  '/api/stations',
];

// Routes that require DRIVER auth (driver role)
const DRIVER_API_ROUTES = [
  '/api/driver/manifest',
];

// Routes that accept BOTH admin or driver auth
const SHARED_API_ROUTES = [
  '/api/transport',  // /api/transport/[id] PATCH for status updates
];

// Check if path starts with any of the given prefixes
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname === route || pathname.startsWith(route + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
    return NextResponse.next();
  }

  // Extract token
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = payload.role as string;

    // Driver routes require driver role
    if (matchesRoute(pathname, DRIVER_API_ROUTES)) {
      if (role !== 'driver') {
        return NextResponse.json(
          { error: 'Driver access required' },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    // Shared routes accept admin OR driver
    if (matchesRoute(pathname, SHARED_API_ROUTES)) {
      if (role !== 'admin' && role !== 'driver') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 403 }
        );
      }
      return NextResponse.next();
    }

    // All other API routes require admin role
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  } catch {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: '/api/:path*',
};
