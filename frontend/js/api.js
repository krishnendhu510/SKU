/**
 * API Client — Centralized fetch wrapper with automatic token management
 */

const API_BASE = '/api';

let accessToken = localStorage.getItem('sku_access_token');
let refreshToken = localStorage.getItem('sku_refresh_token');
let isRefreshing = false;
let refreshQueue = [];

/**
 * Set auth tokens
 */
export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem('sku_access_token', access);
  } else {
    localStorage.removeItem('sku_access_token');
  }
  if (refresh) {
    localStorage.setItem('sku_refresh_token', refresh);
  } else {
    localStorage.removeItem('sku_refresh_token');
  }
}

/**
 * Get current user from token
 */
export function getCurrentUser() {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    // Check expiry
    if (payload.exp * 1000 < Date.now()) {
      return null; // Expired, will refresh on next API call
    }
    return { id: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

/**
 * Check if user is logged in (has valid-looking tokens)
 */
export function isLoggedIn() {
  return !!accessToken && !!refreshToken;
}

/**
 * Logout — clear tokens
 */
export async function logout() {
  try {
    await fetchAPI('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {} // Don't block on logout failure
  setTokens(null, null);
  localStorage.removeItem('sku_user');
}

/**
 * Main fetch wrapper
 */
export async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle 401 — attempt token refresh
  if (response.status === 401 && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw { status: response.status, ...data };
  }

  return data;
}

/**
 * Try to refresh the access token
 */
async function tryRefreshToken() {
  if (isRefreshing) {
    // Wait for the existing refresh to complete
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh failed — force logout
      setTokens(null, null);
      isRefreshing = false;
      refreshQueue.forEach((cb) => cb(false));
      refreshQueue = [];
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    isRefreshing = false;
    refreshQueue.forEach((cb) => cb(true));
    refreshQueue = [];
    return true;
  } catch {
    setTokens(null, null);
    isRefreshing = false;
    refreshQueue.forEach((cb) => cb(false));
    refreshQueue = [];
    return false;
  }
}
