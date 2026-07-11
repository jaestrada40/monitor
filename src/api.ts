/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserSession,
  Website,
  Incident,
  NotificationSettings,
  WorkspaceSettings,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    register: (email: string, password: string, username: string) =>
      request<{ user: UserSession }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, username }) }),
    login: (email: string, password: string) =>
      request<{ user: UserSession }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: UserSession }>('/auth/me'),
  },
  websites: {
    list: () => request<{ websites: Website[] }>('/websites'),
    create: (data: Omit<Website, 'id' | 'responseTimeHistory' | 'lastChecked' | 'uptime24h' | 'uptime30d' | 'responseTime'>) =>
      request<{ website: Website }>('/websites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Website>) =>
      request<{ website: Website }>(`/websites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<{ ok: true }>(`/websites/${id}`, { method: 'DELETE' }),
    toggleStatus: (id: string) => request<{ website: Website }>(`/websites/${id}/toggle-status`, { method: 'POST' }),
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
  },
  settings: {
    get: () => request<{ settings: WorkspaceSettings }>('/settings'),
    update: (data: WorkspaceSettings) =>
      request<{ settings: WorkspaceSettings }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
