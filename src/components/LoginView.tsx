/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, ShieldAlert, Key, Mail, Lock, Eye, EyeOff, Terminal, ShieldCheck } from 'lucide-react';
import { UserSession } from '../types';
import { api } from '../api';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu dirección de correo electrónico.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { user } = await api.auth.login(email, password);
      onLoginSuccess(user);
    } catch {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col lg:flex-row font-sans text-slate-100">
      
      {/* Left Column: Form */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-slate-900 border-r border-slate-800 relative z-10">
        <div className="max-w-md w-full mx-auto">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="font-display font-black text-white text-2xl tracking-tight leading-none">MonitorPro</div>
              <span className="text-xs text-indigo-400 font-mono tracking-wider">ENTERPRISE MONITORS</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">Acceso al Centro de Control</h1>
            <p className="text-sm text-slate-400 mt-1.5">Monitoreo de infraestructura global y respuesta ante incidentes.</p>
          </div>

          {error && (
            <div className="p-3 mb-6 bg-rose-950/40 border border-rose-900/40 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form body */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Correo Electrónico</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all"
                  placeholder="ejemplo@empresa.com"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Contraseña</label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert("Enlace de recuperación enviado al correo proporcionado."); }} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">¿Olvidaste la contraseña?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all"
                  placeholder="Ingresa tu clave de acceso"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded-sm bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-600/30 cursor-pointer"
                />
                <span className="text-xs text-slate-400 font-medium">Mantener sesión iniciada</span>
              </label>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-800/50 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>Ingresar al Workspace</span>
              )}
            </button>
          </form>

          {/* Quick Info Credentials for Preview */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <span className="text-xs text-slate-500">Credenciales de acceso rápido (modo demostración):</span>
            <div className="mt-2.5 bg-slate-950/80 border border-slate-800/60 p-2 rounded-lg text-xs font-mono text-indigo-400 flex items-center justify-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>laura@monitorpro.io</span>
              <span className="text-slate-600">/</span>
              <span>Cualquier contraseña</span>
            </div>
          </div>

        </div>
      </div>

      {/* Right Column: High fidelity dashboard mock preview */}
      <div className="hidden lg:flex flex-1 bg-slate-950 items-center justify-center relative overflow-hidden p-12">
        {/* Background decorative grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>

        {/* Console / Infographics panel */}
        <div className="max-w-xl w-full bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-6 relative backdrop-blur-md">
          {/* Status badge */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">TODOS LOS PROBES OPERATIVOS</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">SLA GLOBAL: 99.982%</span>
          </div>

          <h2 className="text-xl font-display font-bold text-white mb-2 leading-tight">Monitoreo Sintético y Diagnóstico Predictivo</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            MonitorPro supervisa continuamente tus microservicios, bases de datos y portales web en tiempo real desde 6 ubicaciones distribuidas globalmente.
          </p>

          {/* Quick Metrics grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Uptime Promedio</span>
              <div className="text-lg font-bold text-white font-mono mt-0.5">99.97%</div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Latencia Global</span>
              <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">142ms</div>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Total Chequeos / min</span>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">2,840</div>
            </div>
          </div>

          {/* Simulation Console log */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2">
            <div className="flex justify-between text-slate-500 border-b border-slate-900 pb-2 mb-1">
              <span>SISTEMA DE EVENTOS SINTÉTICOS</span>
              <span>LIVE FEED</span>
            </div>
            <div className="flex gap-2">
              <span className="text-emerald-500">[OK]</span>
              <span className="text-slate-500">14:02:11</span>
              <span>Ping a Portal de Clientes desde US-East: 124ms</span>
            </div>
            <div className="flex gap-2">
              <span className="text-indigo-400">[INF]</span>
              <span className="text-slate-500">14:02:15</span>
              <span>Resolución DNS exitosa para payments.monitorpro.io</span>
            </div>
            <div className="flex gap-2">
              <span className="text-rose-500 text-xs animate-pulse font-bold">[ERR]</span>
              <span className="text-slate-500">14:02:18</span>
              <span className="text-rose-400">Fallo SSL en Servidor de Logs (Expirado hace 2 días)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-amber-500">[WARN]</span>
              <span className="text-slate-500">14:02:22</span>
              <span className="text-amber-300">Latencia en DB Cluster superó umbral: 432ms</span>
            </div>
          </div>

          {/* SLA badge and icons footer */}
          <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Canal Seguro TLS 1.3</span>
            <span>Ubicaciones: NY, LON, FRA, SGP, TOK, SYD</span>
          </div>
        </div>
      </div>

    </div>
  );
}
