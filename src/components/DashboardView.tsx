/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Bell,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { Website, Incident, NotificationSettings } from '../types';

interface DashboardViewProps {
  websites: Website[];
  incidents: Incident[];
  notifications: NotificationSettings;
  latencyHistory: { timestamp: string; value: number }[];
  onNavigateToView: (view: any, extraData?: any) => void;
  onAcknowledgeIncident: (id: string) => void;
  onResolveIncident: (id: string) => void;
}

export default function DashboardView({
  websites,
  incidents,
  notifications,
  latencyHistory,
  onNavigateToView,
  onAcknowledgeIncident,
  onResolveIncident
}: DashboardViewProps) {

  // Compute metrics
  const totalWebsites = websites.length;
  const activeWebsites = websites.filter(w => w.status === 'up').length;
  
  // Average response time (only for active up websites, down is 0)
  const upWebsites = websites.filter(w => w.status === 'up' || w.status === 'degraded');
  const avgResponseTime = upWebsites.length > 0 
    ? Math.round(upWebsites.reduce((acc, curr) => acc + curr.responseTime, 0) / upWebsites.length) 
    : 0;

  // Average 30-day uptime
  const avgUptime30d = Number((websites.reduce((acc, curr) => acc + curr.uptime30d, 0) / totalWebsites).toFixed(2));

  // Active incidents count
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const criticalCount = activeIncidents.filter(i => i.severity === 'critical').length;
  const warningCount = activeIncidents.filter(i => i.severity === 'warning').length;

  // Active notification channels
  const activeChannels = [
    notifications.email && 'Email',
    notifications.slack && 'Slack',
    notifications.sms && 'SMS',
    notifications.telegram && 'Telegram'
  ].filter(Boolean);

  // Real latency history, averaged per hour across all monitored sites (server-computed).
  const chartPoints = latencyHistory.map((p) => ({ label: p.timestamp, val: p.value }));

  const maxVal = chartPoints.length > 0 ? Math.max(...chartPoints.map(p => p.val)) : 0;
  const minVal = chartPoints.length > 0 ? Math.min(...chartPoints.map(p => p.val)) : 0;

  // Create SVG path coordinates
  const width = 600;
  const height = 140;
  const paddingX = 40;
  const paddingY = 20;

  const pointsString = chartPoints.map((p, i) => {
    const x = paddingX + (i * (width - 2 * paddingX)) / (Math.max(chartPoints.length - 1, 1));
    const y = height - paddingY - ((p.val - minVal) * (height - 2 * paddingY)) / (maxVal - minVal || 1);
    return `${x},${y}`;
  }).join(' ');

  // Create coordinate path for area fill (closed loop under line)
  const areaString = `${paddingX},${height - paddingY} ` + pointsString + ` ${width - paddingX},${height - paddingY}`;

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Panel de Control</h1>
          <p className="text-sm text-slate-500">Métricas en tiempo real, alarmas activas e inventario sintético.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Estado global:</span>
          {activeIncidents.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Todos los sistemas normales
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              {activeIncidents.length} incidente{activeIncidents.length > 1 ? 's' : ''} activo{activeIncidents.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Uptime */}
        <div id="kpi-uptime" className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Uptime Global (30d)</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{avgUptime30d}%</div>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-medium text-slate-600">{activeWebsites}/{totalWebsites} sitios arriba</span>
            <span>Objetivo: &ge;99.9%</span>
          </div>
        </div>

        {/* KPI 2: Response Time */}
        <div id="kpi-latency" className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Latencia Media</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{avgResponseTime}ms</div>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-medium text-slate-600">Basado en {upWebsites.length} sitio{upWebsites.length !== 1 ? 's' : ''} activo{upWebsites.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* KPI 3: Active Incidents */}
        <div id="kpi-incidents" className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alarmas Activas</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{activeIncidents.length}</div>
            </div>
            <div className={`p-2.5 rounded-lg border ${
              activeIncidents.length > 0 
                ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' 
                : 'bg-slate-50 text-slate-600 border-slate-100'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-medium text-slate-600">
              {criticalCount} Crítico | {warningCount} Advertencia
            </span>
            <button 
              onClick={() => onNavigateToView('incidents')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center font-bold"
            >
              Ver registro
            </button>
          </div>
        </div>

        {/* KPI 4: Notification Channels */}
        <div id="kpi-channels" className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alertas Configuras</span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{activeChannels.length}/4</div>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
              <Bell className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span className="text-slate-500 truncate max-w-[150px]">
              {activeChannels.join(', ') || 'Ninguno'}
            </span>
            <button 
              onClick={() => onNavigateToView('notifications')}
              className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center font-bold"
            >
              Ajustar
            </button>
          </div>
        </div>

      </div>

      {/* Latency History Chart Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Latencia Histórica Global</h3>
            <p className="text-xs text-slate-500">Promedio real por hora, calculado sobre todos los sitios monitoreados en las últimas 24 horas.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold">
              Máx: {maxVal}ms
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono font-bold">
              Mín: {minVal}ms
            </span>
          </div>
        </div>

        {/* Custom SVG Line Graph */}
        {chartPoints.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Clock className="w-8 h-8 text-slate-300 mb-2.5 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-800">Aún no hay suficiente historial</p>
            <p className="text-[11px] text-slate-500 max-w-[280px] mt-1">
              El motor de monitoreo empezará a mostrar aquí el promedio real de latencia a medida que acumule checks.
            </p>
          </div>
        ) : (
        <div className="relative pt-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 text-indigo-600"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Soft purple-blue gradient under line */}
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
            <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
            <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" strokeWidth="1" />

            {/* Area Path */}
            <path d={areaString} fill="url(#areaGrad)" />

            {/* Line Path */}
            <polyline
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              points={pointsString}
            />

            {/* Dots for points */}
            {chartPoints.map((p, i) => {
              const x = paddingX + (i * (width - 2 * paddingX)) / (Math.max(chartPoints.length - 1, 1));
              const y = height - paddingY - ((p.val - minVal) * (height - 2 * paddingY)) / (maxVal - minVal || 1);
              const isSpike = p.val === maxVal;
              return (
                <g key={i} className="group/dot cursor-pointer">
                  <circle
                    cx={x}
                    cy={y}
                    r={isSpike ? 5 : 4}
                    fill={isSpike ? '#ef4444' : '#6366f1'}
                    stroke="white"
                    strokeWidth="1.5"
                    className="transition-all duration-150 hover:r-6"
                  />
                  {/* Subtle hover tooltip wrapper via standard browser title */}
                  <title>{`${p.label}: ${p.val} ms`}</title>
                </g>
              );
            })}
          </svg>

          {/* X Axis Labels */}
          <div className="flex justify-between px-8 text-[10px] font-mono font-bold text-slate-500 mt-1">
            {chartPoints.map((p, i) => <span key={i}>{p.label}</span>)}
          </div>
        </div>
        )}
      </div>

      {/* Recent Active Incidents (full width now that the DevOps checklist column is gone) */}
      <div className="grid grid-cols-1 gap-5">

        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                Alarmas y Eventos en Curso
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-100 text-slate-600 border border-slate-200/60">
                TOTAL: {activeIncidents.length} ACTIVO
              </span>
            </div>

            {activeIncidents.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2.5 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-800">Cero incidentes en progreso</p>
                <p className="text-[11px] text-slate-500 max-w-[280px] mt-1">Todas las sondas reportan un estado operativo de 100% de éxito.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeIncidents.map((incident) => (
                  <div 
                    key={incident.id} 
                    className={`p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 transition-colors ${
                      incident.severity === 'critical'
                        ? 'bg-rose-50/50 border-rose-100 hover:bg-rose-50/80'
                        : 'bg-amber-50/50 border-amber-100 hover:bg-amber-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        incident.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 line-clamp-1">{incident.title}</div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 font-medium">
                          <span className="font-semibold text-indigo-600 underline cursor-pointer" onClick={() => onNavigateToView('details', incident.websiteId)}>
                            {incident.websiteName}
                          </span>
                          <span>&bull;</span>
                          <span className="font-mono flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>&bull;</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold font-mono ${
                            incident.status === 'acknowledged' 
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200/50' 
                              : 'bg-rose-100 text-rose-800 border border-rose-200/50'
                          }`}>
                            {incident.status === 'acknowledged' ? 'Aceptado' : 'Sin Aceptar'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {incident.status === 'active' && (
                        <button
                          onClick={() => onAcknowledgeIncident(incident.id)}
                          className="px-2.5 py-1 text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          Aceptar
                        </button>
                      )}
                      <button
                        onClick={() => onResolveIncident(incident.id)}
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 border border-emerald-700 rounded-md hover:bg-emerald-700 transition-colors"
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs text-slate-500">
            <button
              onClick={() => onNavigateToView('incidents')}
              className="text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Historial completo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Services status overview table card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Estado de los Sitios Monitoreados</h3>
            <p className="text-xs text-slate-500">Listado abreviado de sondas activas y latencia instantánea.</p>
          </div>
          <button 
            onClick={() => onNavigateToView('inventory')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
          >
            Ver inventario completo <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                <th className="pb-3 font-semibold">SITIO / ENDPOINT</th>
                <th className="pb-3 font-semibold">ESTADO</th>
                <th className="pb-3 font-semibold text-center">UPTIME (24h)</th>
                <th className="pb-3 font-semibold text-center">LATENCIA</th>
                <th className="pb-3 font-semibold">CERTIFICADO SSL</th>
                <th className="pb-3 font-semibold text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {websites.slice(0, 4).map((web) => (
                <tr key={web.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3">
                    <div className="font-bold text-slate-900">{web.name}</div>
                    <span className="text-[11px] text-slate-400 font-mono">{web.url}</span>
                  </td>
                  <td className="py-3">
                    {web.status === 'up' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 uppercase">
                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Up
                      </span>
                    )}
                  {web.status === 'degraded' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700 uppercase">
                        <span className="w-1 h-1 rounded-full bg-amber-500"></span> Degradado
                      </span>
                  )}
                  {web.status === 'protected' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-700 uppercase" title="Cloudflare responde, pero el contenido no puede verificarse">
                      <ShieldAlert className="w-3 h-3" /> Protegido
                    </span>
                  )}
                    {web.status === 'maintenance' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 uppercase">
                        <span className="w-1 h-1 rounded-full bg-slate-400"></span> Mantenimiento
                      </span>
                    )}
                    {web.status === 'down' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700 uppercase animate-pulse">
                        <span className="w-1 h-1 rounded-full bg-rose-500"></span> Down
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center font-mono font-bold text-slate-800">
                    {web.uptime24h}%
                  </td>
                  <td className="py-3 text-center">
                    <div className="font-mono font-bold text-slate-800">
                      {web.responseTime > 0 ? `${web.responseTime}ms` : '--'}
                    </div>
                  </td>
                  <td className="py-3">
                    {web.sslStatus === 'valid' && (
                      <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> {web.sslExpiryDays} días
                      </span>
                    )}
                    {web.sslStatus === 'expiring' && (
                      <span className="text-amber-600 font-medium flex items-center gap-1 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Expirando ({web.sslExpiryDays}d)
                      </span>
                    )}
                    {web.sslStatus === 'expired' && (
                      <span className="text-rose-600 font-bold flex items-center gap-1 text-[11px]">
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Expirado
                      </span>
                    )}
                    {web.sslStatus === 'none' && (
                      <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                        Ninguno
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <button 
                      onClick={() => onNavigateToView('details', web.id)}
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                    >
                      Analizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
