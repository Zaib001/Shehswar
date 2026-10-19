/**
 * SHEHSWAR ONE360 - Enterprise API Client
 *
 * Provides type-safe REST communication with the backend API, automatic
 * correlationId generation, JWT bearer token attachment, and unified error mapping.
 */
import { ApiResponse, PaginatedResponse } from '@shehswar/types';

export class ApiClient {
  private static get baseUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && envUrl.trim().length > 0) {
      return envUrl.replace(/\/$/, '');
    }
    // In the browser, if NEXT_PUBLIC_API_URL is omitted, use relative path so Next.js rewrites/proxies seamlessly
    if (typeof window !== 'undefined') {
      return '';
    }
    return 'http://localhost:4000';
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
        headers['Authorization'] = `Bearer ${token}`;
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
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return { success: true, data: undefined as any, meta: {} as any };
    }

    if (!res.ok) {
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
