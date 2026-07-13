/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, ShieldAlert, Mail, Lock, Eye, EyeOff, ShieldCheck, X, KeyRound } from 'lucide-react';
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

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const [pendingToken, setPendingToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu dirección de correo electrónico.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const result = await api.auth.login(email, password);
      if ('mfaRequired' in result) {
        setPendingToken(result.pendingToken);
      } else {
        onLoginSuccess(result.user);
      }
    } catch {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) return;
    setMfaError('');
    setMfaLoading(true);
    try {
      const { user } = await api.auth.loginMfa(pendingToken, mfaCode);
      onLoginSuccess(user);
    } catch {
      setMfaError('Código incorrecto o expirado. Intenta de nuevo.');
      setMfaCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSubmitting(true);
    try {
      await api.auth.forgotPassword(forgotEmail);
    } finally {
      setForgotSubmitting(false);
      // Always show the same confirmation, whether or not the email is registered —
      // avoids leaking which addresses have accounts.
      setForgotSent(true);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSent(false);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 py-12 font-sans text-slate-100">

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl px-6 sm:px-10 py-10 shadow-2xl">

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
            <h1 className="text-2xl font-display font-bold text-white tracking-tight">
              {pendingToken ? 'Verificación en dos pasos' : 'Acceso al Centro de Control'}
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              {pendingToken
                ? 'Ingresa el código de 6 dígitos de tu app de autenticación.'
                : 'Monitoreo de infraestructura global y respuesta ante incidentes.'}
            </p>
          </div>

          {pendingToken ? (
            <>
              {mfaError && (
                <div className="p-3 mb-6 bg-rose-950/40 border border-rose-900/40 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{mfaError}</span>
                </div>
              )}
              <form onSubmit={handleMfaSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Código de verificación</label>
                  <div className="relative group">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      id="login-mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all tracking-[0.3em]"
                      placeholder="000000"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-800/50 text-white rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 cursor-pointer"
                >
                  {mfaLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verificando...</span>
                    </>
                  ) : (
                    <span>Verificar código</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingToken(''); setMfaCode(''); setMfaError(''); }}
                  className="w-full text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Volver al inicio de sesión
                </button>
              </form>
            </>
          ) : (
          <>
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
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  ¿Olvidaste la contraseña?
                </button>
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
          </>
          )}

      </div>

      {showForgotPassword && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-display font-bold text-sm text-white tracking-wide">Recuperar contraseña</h3>
              <button onClick={closeForgotPassword} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotSent ? (
              <div className="p-6 space-y-4 text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm text-slate-300">
                  Si <strong className="text-white">{forgotEmail}</strong> tiene una cuenta, te enviamos un correo con instrucciones para restablecer tu contraseña.
                </p>
                <button
                  onClick={closeForgotPassword}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
                <p className="text-xs text-slate-400">Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm font-medium text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500 focus:bg-slate-950 transition-all"
                    placeholder="ejemplo@empresa.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/50 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  {forgotSubmitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
