/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Globe2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Plus
} from 'lucide-react';
import { UserSession } from '../types';

interface TopNavBarProps {
  user: UserSession | null;
  onQuickAdd: () => void;
  totalWebsites?: number;
  upWebsites?: number;
  criticalIncidents?: number;
  warningIncidents?: number;
}

export default function TopNavBar({
  user,
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
      className="h-16 border-b border-slate-200 bg-white fixed top-0 right-0 left-64 flex items-center px-6 z-20 shadow-xs"
    >
      {/* DevOps Clocks & Probe Live status */}
      <div className="flex items-center gap-6 ml-auto">
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
