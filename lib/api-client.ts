import { getToken, getDriverToken } from '@/lib/storage';

/**
 * Authenticated fetch for admin API calls.
 * Automatically attaches Bearer token from localStorage.
 */
export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}

/**
 * Authenticated fetch for driver API calls.
 * Automatically attaches Bearer token from localStorage.
 */
export async function driverFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getDriverToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers });
}
