/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe2,
  Clock,
  Server,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Sparkles,
  Command
} from 'lucide-react';
import { UserSession } from '../types';

interface TopNavBarProps {
  user: UserSession | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickAdd: () => void;
  totalWebsites?: number;
  upWebsites?: number;
  criticalIncidents?: number;
  warningIncidents?: number;
}

export default function TopNavBar({
  user,
  searchQuery,
  onSearchChange,
  onQuickAdd,
  totalWebsites = 0,
  upWebsites = 0,
  criticalIncidents = 0,
  warningIncidents = 0,
}: TopNavBarProps) {
  const [localTime, setLocalTime] = useState<string>('');
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLocalTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setUtcTime(now.toUTCString().replace('GMT', 'UTC').split(' ')[4]);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  return (
    <header 
      id="main-topbar"
      className="h-16 border-b border-slate-200 bg-white fixed top-0 right-0 left-64 flex items-center justify-between px-6 z-20 shadow-xs"
    >
      {/* Search & Global Probe Summary */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <div className="relative w-full group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <input
            id="global-search"
            type="text"
            placeholder="Buscar por sitio, URL, etiqueta, estado... (Presiona '/' para buscar)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-200/60 rounded text-[9px] font-mono text-slate-500 border border-slate-300/30 select-none pointer-events-none">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* DevOps Clocks & Probe Live status */}
      <div className="flex items-center gap-6">
        {/* System Health Summary */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-slate-600 border-r border-slate-200 pr-5">
          <div className="flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-indigo-500 animate-spin-slow" />
            <span className="font-mono text-slate-500 font-bold">{upWebsites}/{totalWebsites} Probes</span>
          </div>

          {criticalIncidents > 0 ? (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-rose-600 font-semibold">
                {criticalIncidents} Incidente{criticalIncidents > 1 ? 's' : ''} Crítico{criticalIncidents > 1 ? 's' : ''}
              </span>
            </div>
          ) : warningIncidents > 0 ? (
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 font-semibold">
                {warningIncidents} Advertencia{warningIncidents > 1 ? 's' : ''} Activa{warningIncidents > 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600">Sistemas Operativos</span>
            </div>
          )}
        </div>

        {/* Timestamps (Local & UTC) */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-lg">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">LOC:</span>
            <span className="text-slate-700 font-bold w-14">{localTime || '--:--:--'}</span>
          </div>
          <div className="h-3 w-px bg-slate-200"></div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium font-mono">
            <span className="text-slate-400">UTC:</span>
            <span className="text-slate-600 font-bold w-14">{utcTime || '--:--:--'}</span>
          </div>
        </div>

        {/* Quick Action */}
        <button
          id="topbar-quick-add"
          onClick={onQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Añadir Sitio</span>
        </button>
      </div>
    </header>
  );
}
