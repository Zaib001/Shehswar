/**
 * SHEHSWAR ONE360 - Enterprise API Client
 *
 * Provides type-safe REST communication with the backend API, automatic
 * correlationId generation, JWT bearer token attachment, and unified error mapping.
 */
import { ApiResponse, PaginatedResponse } from '@shehswar/types';

export class ApiClient {
  private static baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
}
