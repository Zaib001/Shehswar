/**
 * SHEHSWAR ONE360 - Enterprise API Client
 *
 * Provides type-safe REST communication with the backend API, automatic
 * correlationId generation, JWT bearer token attachment, and unified error mapping.
 */
import { ApiResponse, PaginatedResponse } from '@shehswar/types';

/**
 * Checks if a JWT token has reached or passed its expiration timestamp.
 */
export function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    // Current time in seconds vs token exp
    return Math.floor(Date.now() / 1000) >= parsed.exp;
  } catch {
    return true;
  }
}

export class ApiClient {
  private static get baseUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl.trim().length > 0) {
      return envUrl.replace(/\/$/, '');
    }
    // In browser on Render, automatically route directly to the deployed API
    if (typeof window !== 'undefined') {
      if (window.location.hostname.includes('shehswar-web') || window.location.hostname.includes('onrender.com')) {
        return 'https://shehswar-api.onrender.com';
      }
      return '';
    }
    const serverTarget = process.env.BACKEND_API_URL || process.env.INTERNAL_API_URL;
    if (serverTarget) {
      if (serverTarget.includes('shehswar-api') && !serverTarget.includes('.')) {
        return 'https://shehswar-api.onrender.com';
      }
      return serverTarget.startsWith('http') ? serverTarget.replace(/\/$/, '') : `http://${serverTarget.replace(/\/$/, '')}`;
    }
    return process.env.NODE_ENV === 'production'
      ? 'https://shehswar-api.onrender.com'
      : 'http://localhost:4000';
  }

  /**
   * Cleans invalid/expired credentials and redirects browser to login page
   */
  public static handleUnauthorized(path?: string) {
    if (typeof window === 'undefined') return;
    if (path && path.includes('/auth/login')) return;

    localStorage.removeItem('shehswar_token');
    localStorage.removeItem('shehswar_refresh_token');
    localStorage.removeItem('shehswar_active_company');
    localStorage.removeItem('shehswar_active_company_name');

    window.dispatchEvent(new CustomEvent('shehswar:auth:expired'));

    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=1';
    }
  }

  private static getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-ID':
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'web-client-req',
      ...customHeaders,
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('shehswar_token');
      if (token) {
        if (isJwtExpired(token)) {
          this.handleUnauthorized();
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
      const activeCompanyId = localStorage.getItem('shehswar_active_company');
      if (activeCompanyId) {
        headers['X-Company-ID'] = activeCompanyId;
      }
    }

    return headers;
  }

  static async get<T>(path: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(headers),
    });

    const body = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(body.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return body;
  }

  static async post<T, B = unknown>(
    path: string,
    body: B,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(headers),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  static async patch<T, B = unknown>(
    path: string,
    body?: B,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  static async put<T, B = unknown>(
    path: string,
    body?: B,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(headers),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  static async delete<T>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(headers),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return data;
  }

  static async getPaginated<T>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<PaginatedResponse<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.getHeaders(headers),
    });

    const body = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      throw new Error(body.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }
    return body;
  }

  static async uploadFile<T>(
    path: string,
    formData: FormData,
    customHeaders?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    const headers = this.getHeaders(customHeaders);
    // Remove Content-Type so the browser automatically sets multipart/form-data with the boundary
    delete headers['Content-Type'];

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      if (!res.ok) {
        if (res.status === 401) {
          this.handleUnauthorized(path);
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return { success: true, data: undefined as any, meta: {} as any };
    }

    if (!res.ok) {
      if (res.status === 401) {
        this.handleUnauthorized(path);
      }
      const errMsg =
        data?.error?.message ||
        data?.message ||
        (Array.isArray(data?.error) ? data.error.join(', ') : null) ||
        `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(errMsg);
    }
    return data;
  }
}
