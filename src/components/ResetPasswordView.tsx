/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

interface ResetPasswordViewProps {
  token: string;
  onDone: () => void;
}

export default function ResetPasswordView({ token, onDone }: ResetPasswordViewProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
    } catch {
      setError('El enlace es inválido o expiró. Solicita uno nuevo desde la pantalla de inicio de sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6 font-sans text-slate-100">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="font-display font-black text-white text-2xl tracking-tight leading-none">MonitorPro</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h1 className="text-lg font-display font-bold text-white">Contraseña actualizada</h1>
              <p className="text-sm text-slate-400">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <button
                onClick={onDone}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-display font-bold text-white mb-1">Restablecer contraseña</h1>
              <p className="text-sm text-slate-400 mb-6">Ingresa tu nueva contraseña.</p>

              {error && (
                <div className="p-3 mb-5 bg-rose-950/40 border border-rose-900/40 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nueva contraseña</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-10 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all"
                      placeholder="Mínimo 8 caracteres"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Confirmar contraseña</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all"
                      placeholder="Repite la contraseña"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  {loading ? 'Guardando...' : 'Restablecer contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
