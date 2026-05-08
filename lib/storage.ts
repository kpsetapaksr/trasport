import type { Admin } from '@/lib/types';

const ADMIN_KEY = 'transport_admin';
const TOKEN_KEY = 'transport_token';
const DRIVER_TOKEN_KEY = 'driver_token';

// --- Admin ---

export function getCurrentAdmin(): Admin | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(ADMIN_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setCurrentAdmin(admin: Admin | null) {
  if (typeof window === 'undefined') return;
  if (admin) {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  } else {
    localStorage.removeItem(ADMIN_KEY);
  }
}

// --- Tokens ---

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getDriverToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(DRIVER_TOKEN_KEY);
}

export function setDriverToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(DRIVER_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(DRIVER_TOKEN_KEY);
  }
}

// --- Logout helpers ---

export function clearAdminSession() {
  setCurrentAdmin(null);
  setToken(null);
}

export function clearDriverSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRIVER_TOKEN_KEY);
  localStorage.removeItem('driver_phone');
  localStorage.removeItem('driver_name');
}
