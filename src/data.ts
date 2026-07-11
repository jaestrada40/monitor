/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Website, Incident, NotificationSettings, WorkspaceSettings, UserSession } from './types';

// Helper to generate a 24-hour response time history with realistic variance
const generateResponseTimeHistory = (base: number, status: string, count = 24) => {
  const history = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const label = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let variance = (Math.random() - 0.5) * (base * 0.2); // 20% variance
    if (status === 'degraded' && i > 16) {
      variance += base * 1.5; // Simulate a spike
    } else if (status === 'down' && i > 18) {
      variance = -base; // Represent down (0 ms or very high, but let's store 0 for down)
    }
    
    const value = status === 'down' && i > 18 ? 0 : Math.max(10, Math.round(base + variance));
    history.push({ timestamp: label, value });
  }
  return history;
};

export const INITIAL_WEBSITES: Website[] = [
  {
    id: 'web-1',
    name: 'Portal de Clientes',
    url: 'https://portal.monitorpro.io',
    status: 'up',
    uptime24h: 99.98,
    uptime30d: 99.95,
    responseTime: 124,
    responseTimeHistory: generateResponseTimeHistory(124, 'up'),
    sslStatus: 'valid',
    sslExpiryDays: 142,
    lastChecked: new Date(Date.now() - 12000).toISOString(),
    checkInterval: 30,
    locations: ['US-East', 'EU-West'],
    tags: ['Production', 'Frontend', 'SaaS']
  },
  {
    id: 'web-2',
    name: 'API Principal (v2)',
    url: 'https://api.monitorpro.io/v2',
    status: 'up',
    uptime24h: 100.00,
    uptime30d: 99.99,
    responseTime: 82,
    responseTimeHistory: generateResponseTimeHistory(82, 'up'),
    sslStatus: 'valid',
    sslExpiryDays: 28,
    lastChecked: new Date(Date.now() - 8000).toISOString(),
    checkInterval: 30,
    locations: ['US-East', 'EU-West', 'AP-South'],
    tags: ['Production', 'Backend', 'Core']
  },
  {
    id: 'web-3',
    name: 'Base de Datos Clúster',
    url: 'https://db.internal.monitorpro.io',
    status: 'degraded',
    uptime24h: 99.12,
    uptime30d: 99.85,
    responseTime: 432,
    responseTimeHistory: generateResponseTimeHistory(180, 'degraded'),
    sslStatus: 'none',
    sslExpiryDays: 0,
    lastChecked: new Date(Date.now() - 15000).toISOString(),
    checkInterval: 60,
    locations: ['US-East'],
    tags: ['Internal', 'Database', 'Private']
  },
  {
    id: 'web-4',
    name: 'Microservicio de Pagos',
    url: 'https://payments.monitorpro.io',
    status: 'up',
    uptime24h: 99.95,
    uptime30d: 99.90,
    responseTime: 215,
    responseTimeHistory: generateResponseTimeHistory(215, 'up'),
    sslStatus: 'valid',
    sslExpiryDays: 85,
    lastChecked: new Date(Date.now() - 5000).toISOString(),
    checkInterval: 30,
    locations: ['US-East', 'EU-West'],
    tags: ['Production', 'Payments', 'Security']
  },
  {
    id: 'web-5',
    name: 'Web de Marketing',
    url: 'https://monitorpro.io',
    status: 'maintenance',
    uptime24h: 100.00,
    uptime30d: 100.00,
    responseTime: 198,
    responseTimeHistory: generateResponseTimeHistory(198, 'up'),
    sslStatus: 'expiring',
    sslExpiryDays: 6,
    lastChecked: new Date(Date.now() - 64000).toISOString(),
    checkInterval: 300,
    locations: ['Global CDN'],
    tags: ['Marketing', 'Public']
  },
  {
    id: 'web-6',
    name: 'Servidor de Logs',
    url: 'https://logs.internal.monitorpro.io',
    status: 'down',
    uptime24h: 94.20,
    uptime30d: 98.45,
    responseTime: 0,
    responseTimeHistory: generateResponseTimeHistory(150, 'down'),
    sslStatus: 'expired',
    sslExpiryDays: -2,
    lastChecked: new Date(Date.now() - 4000).toISOString(),
    checkInterval: 60,
    locations: ['EU-West'],
    tags: ['Internal', 'Logs', 'Elastic']
  }
];

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-101',
    websiteId: 'web-6',
    websiteName: 'Servidor de Logs',
    title: 'Conexión rechazada en puerto 9200 (Elasticsearch)',
    severity: 'critical',
    status: 'active',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    description: 'El clúster de Elasticsearch no responde a los pings en el puerto interno 9200. El recolector de FluentBit está encolando logs de forma local. Riesgo alto de pérdida de trazas si continúa por más de 12 horas.'
  },
  {
    id: 'inc-102',
    websiteId: 'web-3',
    websiteName: 'Base de Datos Clúster',
    title: 'Latencia alta en consultas de lectura (I/O Bottleneck)',
    severity: 'warning',
    status: 'acknowledged',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    acknowledgedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    description: 'Se detecta un incremento drástico en el tiempo de respuesta de las consultas de lectura en la réplica secundaria. La utilización de IOPS de almacenamiento está al 98%. Se asigna al equipo de DevOps para escalado de volumen.'
  },
  {
    id: 'inc-103',
    websiteId: 'web-1',
    websiteName: 'Portal de Clientes',
    title: 'Error 502 Bad Gateway intermitente',
    severity: 'critical',
    status: 'resolved',
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
    acknowledgedAt: new Date(Date.now() - 24.8 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(),
    duration: '18m',
    description: 'Múltiples balanceadores de carga reportaron errores 502 al intentar conectar con la aplicación node. Se debió a una fuga de memoria en la versión v1.4.2 que causaba el reinicio constante del proceso PM2. Corregido aplicando rollback inmediato a v1.4.1.'
  },
  {
    id: 'inc-104',
    websiteId: 'web-2',
    websiteName: 'API Principal (v2)',
    title: 'Exceso de consumo de CPU en worker nodes',
    severity: 'warning',
    status: 'resolved',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
    acknowledgedAt: new Date(Date.now() - 71.9 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 71.5 * 60 * 60 * 1000).toISOString(),
    duration: '24m',
    description: 'El uso general de CPU superó el umbral del 85% en el grupo auto-scaling de Kubernetes de la API. Se disparó la creación de 4 nodos adicionales resolviendo la saturación.'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationSettings = {
  email: true,
  emailAddress: 'alertas@monitorpro.io',
  slack: true,
  slackWebhook: 'https://example.com/mock-slack-webhook-placeholder',
  sms: false,
  smsPhone: '+34 600 123 456',
  telegram: true,
  telegramChatId: '@MonitorProAlertsBot',
  thresholdResponseTime: 500,
  thresholdSslDays: 7
};

export const INITIAL_WORKSPACE_SETTINGS: WorkspaceSettings = {
  companyName: 'MonitorPro Global S.L.',
  plan: 'pro',
  timezone: 'Europe/Madrid (GMT+2)',
  apiKey: 'mp_live_7a2f9b1c8e3d5f4a6b2c9d8e7f1a3b5c',
  members: [
    { id: 'mem-1', name: 'Laura Martínez', email: 'laura@monitorpro.io', role: 'owner' },
    { id: 'mem-2', name: 'David Sanchis', email: 'david@monitorpro.io', role: 'admin' },
    { id: 'mem-3', name: 'Carlos Ruiz', email: 'carlos@monitorpro.io', role: 'viewer' }
  ]
};

export const DEFAULT_USER: UserSession = {
  id: 'user-default',
  username: 'Laura Martínez',
  email: 'laura@monitorpro.io',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
  role: 'owner'
};

// LocalStorage helpers
export const loadData = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(`monitorpro_${key}`);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.error(`Error loading key ${key} from localStorage:`, e);
    return defaultValue;
  }
};

export const saveData = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(`monitorpro_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving key ${key} to localStorage:`, e);
  }
};
