export const API_BASE = '/api';

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('finance_jwt_token');
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('finance_jwt_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('finance_jwt_token');
  }
}

export interface FetchOptions extends RequestInit {
  bodyData?: any;
}

export async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.bodyData) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.bodyData);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    removeToken();
    if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/')) {
      window.location.href = '/'; // Redirect to login
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }

  // If the response is a binary file download (PDF or Excel spreadsheet), return as blob
  const contentType = response.headers.get('Content-Type');
  if (
    contentType &&
    (contentType.includes('application/pdf') ||
     contentType.includes('spreadsheetml') ||
     contentType.includes('application/vnd.ms-excel') ||
     contentType.includes('application/octet-stream') ||
     contentType.includes('text/csv'))
  ) {
    return response.blob();
  }

  return response.json();
}
