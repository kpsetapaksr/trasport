import { NextResponse } from 'next/server';

// Debug endpoint disabled in production
export async function GET() {
  return NextResponse.json({ error: 'This endpoint is disabled' }, { status: 403 });
}
