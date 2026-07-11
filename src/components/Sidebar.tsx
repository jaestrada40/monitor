/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Activity, 
  Globe, 
  AlertTriangle, 
  FileBarChart, 
  BellRing, 
  Settings, 
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { ViewType, UserSession, Incident } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  user: UserSession | null;
  onLogout: () => void;
  incidents: Incident[];
}

export default function Sidebar({ currentView, onNavigate, user, onLogout, incidents }: SidebarProps) {
  if (!user) return null;

  const activeIncidentsCount = incidents.filter(i => i.status !== 'resolved').length;

  const navItems = [
    { id: 'dashboard', label: 'Panel de Control', icon: Activity },
    { id: 'inventory', label: 'Inventario de Sitios', icon: Globe },
    { 
      id: 'incidents', 
      label: 'Incidentes Activos', 
      icon: AlertTriangle,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
      badgeColor: 'bg-rose-500 text-white'
    },
    { id: 'reports', label: 'Centro de Reportes', icon: FileBarChart },
    { id: 'notifications', label: 'Canales de Alerta', icon: BellRing },
    { id: 'settings', label: 'Ajustes Generales', icon: Settings },
  ];

  return (
    <aside 
      id="main-sidebar"
      className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen fixed left-0 top-0 text-slate-300 z-30"
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2.5">
          <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold text-white text-lg tracking-tight leading-none">MonitorPro</div>
            <span className="text-[10px] text-indigo-400 font-mono tracking-wider">ENTERPRISE SAAS</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id || (item.id === 'inventory' && currentView === 'details');
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => onNavigate(item.id as ViewType)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session Footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 mb-3">
          <div className="flex items-center gap-3">
            <img 
              referrerPolicy="no-referrer"
              src={user.avatarUrl} 
              alt={user.username} 
              className="w-10 h-10 rounded-full border border-slate-700 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.username}</div>
              <div className="text-[10px] text-slate-400 truncate font-mono">{user.email}</div>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] px-0.5 text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
            <span>PLAN: <strong className="text-indigo-400 uppercase">{user.role}</strong></span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </div>
        </div>

        <button
          id="btn-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-rose-950/30 hover:text-rose-400 border border-transparent hover:border-rose-900/30 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
