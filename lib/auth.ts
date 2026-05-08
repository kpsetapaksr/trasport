import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const TOKEN_EXPIRY = '24h';

export interface TokenPayload {
  id: string;
  role: 'admin' | 'driver';
  username?: string;
  phone?: string;
}

/**
 * Sign a JWT token
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from request
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Verify request has valid admin token. Returns payload or error response.
 */
export async function requireAdmin(request: NextRequest): Promise<TokenPayload | NextResponse> {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
  if (payload.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return payload;
}

/**
 * Verify request has valid driver token. Returns payload or error response.
 */
export async function requireDriver(request: NextRequest): Promise<TokenPayload | NextResponse> {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
  if (payload.role !== 'driver') {
    return NextResponse.json({ error: 'Driver access required' }, { status: 403 });
  }
  return payload;
}

/**
 * Check if result is an error NextResponse (used after requireAdmin/requireDriver)
 */
export function isAuthError(result: TokenPayload | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
