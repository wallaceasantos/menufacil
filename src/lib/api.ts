export const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ApiError extends Error {
  status?: number;
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const token = sessionStorage.getItem('jwt_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Erro ${response.status}`) as ApiError;
    error.status = response.status;
    throw error;
  }

  return data as T;
}

export function getToken(): string | null {
  return sessionStorage.getItem('jwt_token');
}

export function setToken(token: string): void {
  sessionStorage.setItem('jwt_token', token);
}

export function removeToken(): void {
  sessionStorage.removeItem('jwt_token');
}

export function apiWithTenant<T>(
  endpoint: string,
  tenantSlug: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
    'x-tenant-slug': tenantSlug,
  };

  return api<T>(endpoint, {
    ...options,
    headers,
  });
}

export async function apiWithTenantBlob(
  endpoint: string,
  tenantSlug: string,
  options: RequestInit = {}
): Promise<Blob> {
  const url = `${API_URL}${endpoint}`;
  const token = sessionStorage.getItem('jwt_token');

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
    'x-tenant-slug': tenantSlug,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status}`);
  }

  return response.blob();
}

export async function uploadImage(file: File, tenantSlug: string): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const url = `${API_URL}/upload/image`;
  const token = sessionStorage.getItem('jwt_token');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-tenant-slug': tenantSlug,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Erro ${response.status}`) as ApiError;
    error.status = response.status;
    throw error;
  }

  return data.url as string;
}

export interface UploadedAttachment {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
}

export async function uploadTicketAttachment(file: File, ticketId: string, tenantSlug?: string): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_URL}/support/tickets/${ticketId}/attachments`;
  const token = sessionStorage.getItem('jwt_token');

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (tenantSlug) {
    headers['x-tenant-slug'] = tenantSlug;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Erro ${response.status}`) as ApiError;
    error.status = response.status;
    throw error;
  }

  return data as UploadedAttachment;
}
