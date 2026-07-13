/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'super-admin' | 'editor';

export interface UserSession {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
}

export interface Website {
  id: string;
  name: string;
  url: string;
  status: 'up' | 'down' | 'degraded' | 'maintenance';
  uptime24h: number;
  uptime30d: number;
  responseTime: number; // in ms
  responseTimeHistory: { timestamp: string; value: number }[];
  sslStatus: 'valid' | 'expiring' | 'expired' | 'none';
  sslExpiryDays: number;
  sslIssuer: string;
  lastChecked: string;
  checkInterval: number; // in seconds
  tags: string[];
}

export interface Incident {
  id: string;
  websiteId: string;
  websiteName: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  duration?: string;
  description: string;
}

export interface NotificationSettings {
  email: boolean;
  emailAddresses: string[];
  slack: boolean;
  slackWebhook: string;
  sms: boolean;
  smsPhone: string;
  telegram: boolean;
  telegramChatId: string;
  thresholdResponseTime: number; // ms
  thresholdSslDays: number; // days
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface WorkspaceSettings {
  companyName: string;
  timezone: string;
  members: WorkspaceMember[];
}

export interface ReportSummary {
  slaPercentage: number;
  mttrMinutes: number | null;
  resolvedCount: number;
  totalCount: number;
  perSiteUptime: { id: string; name: string; uptime: number }[];
}

export interface ScheduledReport {
  enabled: boolean;
  frequency: 'weekly' | 'monthly';
  recipientEmail: string;
  lastSentAt: string | null;
}

export type ViewType =
  | 'login'
  | 'dashboard'
  | 'inventory'
  | 'details'
  | 'incidents'
  | 'reports'
  | 'notifications'
  | 'settings';
