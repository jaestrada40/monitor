/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Globe, 
  MapPin, 
  RotateCw, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Cpu, 
  Server,
  Zap,
  XCircle
} from 'lucide-react';
import { Website, Incident } from '../types';

interface DetailsViewProps {
  website: Website;
  incidents: Incident[];
  onBack: () => void;
  onAcknowledgeIncident: (id: string) => void;
  onResolveIncident: (id: string) => void;
}

export default function DetailsView({
  website,
  incidents,
  onBack,
  onAcknowledgeIncident,
  onResolveIncident
}: DetailsViewProps) {

  // Filter incidents for this specific website
  const siteIncidents = incidents.filter(i => i.websiteId === website.id);
  const activeSiteIncidents = siteIncidents.filter(i => i.status !== 'resolved');
  const resolvedSiteIncidents = siteIncidents.filter(i => i.status === 'resolved');

  // Build the detailed response chart values
  const history = website.responseTimeHistory || [];
  const maxVal = history.length > 0 ? Math.max(...history.map(h => h.value)) : 200;
  const minVal = history.length > 0 ? Math.min(...history.filter(h => h.value > 0).map(h => h.value)) : 50;

  // Render responsive coordinates for custom detailed SVG
  const width = 800;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const pointsString = history.map((p, i) => {
    const x = paddingX + (i * (width - 2 * paddingX)) / (history.length - 1 || 1);
    const y = height - paddingY - (((p.value || 0) - minVal) * (height - 2 * paddingY)) / (maxVal - minVal || 1);
    return `${x},${y}`;
  }).join(' ');

  const areaString = history.length > 0
    ? `${paddingX},${height - paddingY} ` + pointsString + ` ${width - paddingX},${height - paddingY}`
    : '';

  return (
    <div className="space-y-6">
      
      {/* Navigation header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-widest">ANÁLISIS DE TELEMETRÍA</span>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight leading-none mt-1">{website.name}</h1>
        </div>
      </div>

      {/* Hero Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Status indicator */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Estado de Sonda</span>
          <div className="mt-2.5 flex items-center gap-2.5">
            {website.status === 'up' && (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-lg font-bold text-emerald-700">OPERATIVO (UP)</span>
              </>
            )}
            {website.status === 'degraded' && (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <span className="text-lg font-bold text-amber-700">DEGRADADO</span>
              </>
            )}
            {website.status === 'maintenance' && (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 shrink-0"></span>
                <span className="text-lg font-bold text-slate-600">MANTENIMIENTO</span>
              </>
            )}
            {website.status === 'down' && (
              <>
                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse shrink-0"></span>
                <span className="text-lg font-bold text-rose-700 font-display">CAÍDA (DOWN)</span>
              </>
            )}
          </div>
          <span className="text-[11px] text-slate-400 block mt-2 font-mono">Última comprobación: justo ahora</span>
        </div>

        {/* Latency card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Tiempo de Respuesta</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-mono font-bold text-slate-900">
              {website.status === 'down' ? '0' : website.responseTime}
            </span>
            <span className="text-sm text-slate-500 font-semibold font-mono">ms</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Sonda local recomendada: 112ms</span>
        </div>

        {/* Uptime card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">SLA Histórico (30d)</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-mono font-bold text-slate-900">{website.uptime30d}%</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-bold block mt-1 flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3" /> Cumple con el acuerdo
          </span>
        </div>

        {/* Check frequency card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Frecuencia / Intervalo</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-mono font-bold text-indigo-600">{website.checkInterval}s</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Sondas redundantes activas: 3</span>
        </div>

      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (8 cols): Interactive Latency Graph & Location Distributions */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Detailed latency chart card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Historial Latencia 24 Horas</h3>
                <p className="text-xs text-slate-500">Muestreo sintético de velocidad de carga por hora.</p>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="py-16 text-center text-slate-400">Ningún dato disponible en las últimas 24 horas.</div>
            ) : (
              <div className="pt-2">
                <svg 
                  viewBox={`0 0 ${width} ${height}`} 
                  className="w-full h-48 text-indigo-600"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="detailArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Lines Grid */}
                  <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#f1f5f9" strokeWidth="1.5" />
                  <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#f1f5f9" strokeWidth="1.5" />
                  <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#e2e8f0" strokeWidth="1.5" />

                  {/* Area */}
                  <path d={areaString} fill="url(#detailArea)" />

                  {/* Main Line */}
                  <polyline
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    points={pointsString}
                  />

                  {/* Markers */}
                  {history.map((p, i) => {
                    const x = paddingX + (i * (width - 2 * paddingX)) / (history.length - 1 || 1);
                    const y = height - paddingY - (((p.value || 0) - minVal) * (height - 2 * paddingY)) / (maxVal - minVal || 1);
                    const isMin = p.value === minVal;
                    const isMax = p.value === maxVal;
                    
                    return (
                      <g key={i} className="group/detail cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r={isMin || isMax ? 5 : 3.5}
                          fill={isMax ? '#ef4444' : isMin ? '#10b981' : '#4f46e5'}
                          stroke="white"
                          strokeWidth="1.5"
                        />
                        <title>{`${p.timestamp}: ${p.value > 0 ? `${p.value}ms` : 'Caída (Down)'}`}</title>
                      </g>
                    );
                  })}
                </svg>

                {/* X labels */}
                <div className="flex justify-between px-6 text-[9px] font-mono font-bold text-slate-400 mt-2">
                  <span>Hace 24h</span>
                  <span>Hace 18h</span>
                  <span>Hace 12h</span>
                  <span>Hace 6h</span>
                  <span>Ahora</span>
                </div>
              </div>
            )}
          </div>

          {/* Locations distribution card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Latencia por Sonda de Monitoreo</h3>
            
            <div className="space-y-4">
              {[
                { name: 'US-East (Virginia)', code: 'us-east-1', baseTime: Math.round(website.responseTime * 0.95), okRate: 100 },
                { name: 'EU-West (Frankfurt)', code: 'eu-central-1', baseTime: Math.round(website.responseTime * 1.08), okRate: 99.98 },
                { name: 'AP-South (Singapur)', code: 'ap-southeast-1', baseTime: Math.round(website.responseTime * 1.45), okRate: 99.92 }
              ].map((loc) => {
                const latencyVal = website.status === 'down' ? 0 : loc.baseTime;
                const ratio = Math.min(100, Math.round((latencyVal / 600) * 100));
                
                return (
                  <div key={loc.code} className="text-xs space-y-1.5">
                    <div className="flex justify-between font-semibold">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{loc.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">({loc.code})</span>
                      </div>
                      <div className="font-mono flex items-center gap-2">
                        <span className="text-slate-900 font-bold">{latencyVal > 0 ? `${latencyVal}ms` : 'Error / Timeout'}</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-emerald-600 font-bold">{loc.okRate}% Éxito</span>
                      </div>
                    </div>

                    {/* Progress ping bar */}
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div 
                        style={{ width: `${website.status === 'down' ? 0 : Math.max(5, ratio)}%` }} 
                        className={`h-full rounded-full transition-all duration-500 ${
                          website.status === 'down' 
                            ? 'bg-rose-500' 
                            : latencyVal > 350 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-600'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Config, SSL & Incidents related */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Settings & SSL card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Parámetros de Auditoría</h3>
            
            <div className="space-y-3 text-xs text-slate-600 font-medium">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">Nombre Completo</span>
                <div className="bg-slate-50 p-2 rounded-md font-mono text-slate-800 border border-slate-100">
                  {website.name}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">Dirección URL</span>
                <div className="bg-slate-50 p-2 rounded-md font-mono text-slate-800 border border-slate-100 flex justify-between items-center">
                  <span className="truncate mr-2">{website.url}</span>
                  <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* SSL specific box */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">Seguridad TLS / SSL</span>
                
                {website.sslStatus === 'valid' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                      <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Certificado Válido</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">Sello: Let's Encrypt Authority. Expiración en {website.sslExpiryDays} días.</p>
                  </div>
                )}

                {website.sslStatus === 'expiring' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-600">
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Expirará Muy Pronto</span>
                    </div>
                    <p className="text-[10px] text-amber-700 font-semibold">Expiración crítica en solo {website.sslExpiryDays} días. Renueva el certificado inmediatamente.</p>
                  </div>
                )}

                {website.sslStatus === 'expired' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-700">
                      <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Certificado Expirado</span>
                    </div>
                    <p className="text-[10px] text-rose-600 font-bold">Expiró hace {Math.abs(website.sslExpiryDays)} días. Los navegadores de los usuarios bloquearán el acceso.</p>
                  </div>
                )}

                {website.sslStatus === 'none' && (
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-500">
                      <XCircle className="w-4 h-4 text-slate-400" />
                      <span>Sin SSL Configurado</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Endpoint no utiliza el protocolo seguro HTTPS.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Incidents related card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Incidentes de este Sitio</h3>
            
            {siteIncidents.length === 0 ? (
              <div className="py-6 text-center text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">Historial limpio</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No hay alarmas activas ni históricas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Active items */}
                {activeSiteIncidents.map(inc => (
                  <div key={inc.id} className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 leading-snug">{inc.title}</div>
                        <span className="text-[10px] font-mono font-semibold text-slate-400">Abierto: Hace 4 horas</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{inc.description}</p>
                    
                    <div className="flex gap-2 pt-1 border-t border-rose-100/60 justify-end">
                      {inc.status === 'active' && (
                        <button
                          onClick={() => onAcknowledgeIncident(inc.id)}
                          className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 rounded-sm hover:bg-indigo-50"
                        >
                          Aceptar
                        </button>
                      )}
                      <button
                        onClick={() => onResolveIncident(inc.id)}
                        className="px-2 py-0.5 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-sm"
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                ))}

                {/* Resolved items header */}
                {resolvedSiteIncidents.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 block mb-2 uppercase">Historial de Resueltos</span>
                    <div className="space-y-2">
                      {resolvedSiteIncidents.map(inc => (
                        <div key={inc.id} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                          <div className="font-semibold text-slate-800 line-clamp-1">{inc.title}</div>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1.5 font-mono">
                            <span className="text-emerald-600 font-bold">Resuelto</span>
                            <span>Duración: {inc.duration || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
