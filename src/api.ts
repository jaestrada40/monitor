/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserSession,
  UserRole,
  Website,
  Incident,
  NotificationSettings,
  WorkspaceSettings,
  ReportSummary,
  ScheduledReport,
} from './types';

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  avatarUrl: string;
  role: UserRole;
  mfaEnabled?: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

// Maps backend error codes to clear, professional messages for the UI. Codes not listed
// here fall back to a prettified version of the raw code (underscores → spaces, capitalized)
// so the user never sees a raw snake_case token.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_url: 'La dirección URL no es válida. Verifica que el formato sea correcto, por ejemplo https://ejemplo.com.',
  unsupported_scheme: 'La URL debe comenzar con http:// o https://.',
  blocked_address: 'Esa dirección apunta a una red privada o reservada y no puede monitorearse por motivos de seguridad.',
  dns_resolution_failed: 'No se pudo resolver el dominio. Verifica que la URL esté escrita correctamente.',
  too_many_redirects: 'El sitio tiene demasiadas redirecciones y no pudo verificarse.',
  invalid_redirect_location: 'El sitio redirige a una dirección inválida.',
  invalid_name: 'El nombre del sitio no es válido.',
  invalid_check_interval: 'El intervalo de comprobación no es válido.',
  invalid_tags: 'Las etiquetas ingresadas no son válidas.',
  not_found: 'No se encontró el recurso solicitado.',
};

function humanizeErrorCode(code: string): string {
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (!/^[a-z0-9_]+$/.test(code)) return code;
  const words = code.split('_');
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '') + '.';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? humanizeErrorCode(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: UserSession } | { mfaRequired: true; pendingToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    loginMfa: (pendingToken: string, token: string) =>
      request<{ user: UserSession }>('/auth/login/mfa', { method: 'POST', body: JSON.stringify({ pendingToken, token }) }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: UserSession }>('/auth/me'),
    updateAvatar: (avatarUrl: string) =>
      request<{ user: UserSession }>('/auth/me/avatar', { method: 'PUT', body: JSON.stringify({ avatarUrl }) }),
    forgotPassword: (email: string) =>
      request<{ ok: true }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ ok: true }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: true }>('/auth/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    mfaSetup: () => request<{ secret: string; qrCodeDataUrl: string }>('/auth/mfa/setup', { method: 'POST' }),
    mfaVerifySetup: (token: string) =>
      request<{ ok: true }>('/auth/mfa/verify-setup', { method: 'POST', body: JSON.stringify({ token }) }),
    mfaDisable: (token: string) =>
      request<{ ok: true }>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ token }) }),
  },
  websites: {
    list: () => request<{ websites: Website[] }>('/websites'),
    create: (data: Pick<Website, 'name' | 'url' | 'checkInterval' | 'tags'>) =>
      request<{ website: Website }>('/websites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pick<Website, 'name' | 'url' | 'checkInterval' | 'tags'>>) =>
      request<{ website: Website }>(`/websites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<{ ok: true }>(`/websites/${id}`, { method: 'DELETE' }),
    toggleStatus: (id: string) => request<{ website: Website }>(`/websites/${id}/toggle-status`, { method: 'POST' }),
    latencyHistory: () => request<{ points: { timestamp: string; value: number }[] }>('/websites/latency-history'),
  },
  incidents: {
    list: () => request<{ incidents: Incident[] }>('/incidents'),
    acknowledge: (id: string) => request<{ incident: Incident }>(`/incidents/${id}/acknowledge`, { method: 'POST' }),
    resolve: (id: string) => request<{ incident: Incident }>(`/incidents/${id}/resolve`, { method: 'POST' }),
  },
  notifications: {
    get: () => request<{ notifications: NotificationSettings }>('/notifications'),
    update: (data: NotificationSettings) =>
      request<{ notifications: NotificationSettings }>('/notifications', { method: 'PUT', body: JSON.stringify(data) }),
    testEmail: (emailAddress: string) =>
      request<{ ok: true }>('/notifications/test-email', { method: 'POST', body: JSON.stringify({ emailAddress }) }),
  },
  settings: {
    get: () => request<{ settings: WorkspaceSettings }>('/settings'),
    update: (data: WorkspaceSettings) =>
      request<{ settings: WorkspaceSettings }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
  reports: {
    summary: (days: number) => request<ReportSummary>(`/reports/summary?days=${days}`),
    getSchedule: () => request<{ schedule: ScheduledReport }>('/reports/schedule'),
    updateSchedule: (data: ScheduledReport) =>
      request<{ schedule: ScheduledReport }>('/reports/schedule', { method: 'PUT', body: JSON.stringify(data) }),
  },
  admin: {
    listUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
    createUser: (data: { email: string; username: string; role: UserRole }) =>
      request<{ user: AdminUser; activationUrl?: string; emailSent: boolean }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: string, data: Partial<{ username: string; role: UserRole }>) =>
      request<{ user: AdminUser }>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    removeUser: (id: string) => request<{ ok: true }>(`/admin/users/${id}`, { method: 'DELETE' }),
    resetUserMfa: (id: string) => request<{ user: AdminUser }>(`/admin/users/${id}/mfa/disable`, { method: 'POST' }),
  },
};
