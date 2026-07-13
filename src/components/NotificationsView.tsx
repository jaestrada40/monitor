/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mail,
  Slack,
  Send,
  ShieldCheck,
  Smartphone,
  Sliders,
  Lock
} from 'lucide-react';
import { NotificationSettings } from '../types';
import { api } from '../api';

interface NotificationsViewProps {
  notifications: NotificationSettings;
  onSaveNotifications: (settings: NotificationSettings) => void;
}

export default function NotificationsView({ notifications, onSaveNotifications }: NotificationsViewProps) {

  // Local state initialized with current props
  const [email, setEmail] = useState(notifications.email);
  const [emailAddress, setEmailAddress] = useState(notifications.emailAddress);

  const [thresholdResponseTime, setThresholdResponseTime] = useState(notifications.thresholdResponseTime);
  const [thresholdSslDays, setThresholdSslDays] = useState(notifications.thresholdSslDays);

  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveNotifications({
      ...notifications,
      email,
      emailAddress,
      thresholdResponseTime,
      thresholdSslDays,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const testEmailChannel = async () => {
    if (!emailAddress) return;
    setTestingEmail(true);
    setTestResult(null);
    try {
      await api.notifications.testEmail(emailAddress);
      setTestResult({ ok: true, message: `Correo de prueba enviado a ${emailAddress}. Revisa tu bandeja.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send_failed';
      setTestResult({
        ok: false,
        message:
          message === 'smtp_not_configured'
            ? 'El servidor SMTP no está configurado todavía.'
            : 'No se pudo enviar el correo de prueba. Verifica la dirección o la configuración SMTP.',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">

      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Canales de Alerta</h1>
          <p className="text-sm text-slate-500">Configura notificaciones automáticas para alertar al equipo de guardia en segundos.</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>¡Ajustes de alertas guardados correctamente!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left (8 cols): Alerts Toggles forms */}
        <div className="lg:col-span-8 space-y-4">

          {/* Channel 1: Email */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Notificaciones por Correo</h3>
                  <span className="text-[11px] text-slate-400 font-medium">Alertas reales enviadas por email cuando se crea o resuelve un incidente.</span>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(e) => setEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {email && (
              <div className="space-y-2">
                <div className="flex gap-3 text-xs font-semibold">
                  <div className="flex-1">
                    <input
                      type="email"
                      required
                      placeholder="alertas@empresa.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={testEmailChannel}
                    disabled={testingEmail || !emailAddress}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 border border-slate-200 text-slate-700 rounded-lg font-bold transition-all cursor-pointer text-[11px]"
                  >
                    {testingEmail ? 'Enviando...' : 'Probar'}
                  </button>
                </div>
                {testResult && (
                  <p className={`text-[11px] font-semibold ${testResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Channel 2: Slack (not implemented yet) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                  <Slack className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Webhook de Slack
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-100 text-slate-500 border border-slate-200">Próximamente</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Aún no está conectado — el envío a Slack no está implementado.</span>
                </div>
              </div>
              <Lock className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          </div>

          {/* Channel 3: SMS (not implemented yet) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Alertas SMS / Móvil
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-100 text-slate-500 border border-slate-200">Próximamente</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Aún no está conectado — requiere un proveedor de SMS (ej. Twilio).</span>
                </div>
              </div>
              <Lock className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          </div>

          {/* Channel 4: Telegram (not implemented yet) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 opacity-60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Bot de Telegram
                    <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-100 text-slate-500 border border-slate-200">Próximamente</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Aún no está conectado — requiere un bot de Telegram configurado.</span>
                </div>
              </div>
              <Lock className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
          </div>

        </div>

        {/* Right (4 cols): Advanced Thresholds & Save */}
        <div className="lg:col-span-4 space-y-4">

          {/* Rules block */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition-colors">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                Reglas y Umbrales
              </h3>
              <p className="text-xs text-slate-500 font-medium">Establece en qué condiciones se disparan las alertas.</p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Latencia Máxima Soportada</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="50"
                    max="5000"
                    value={thresholdResponseTime}
                    onChange={(e) => setThresholdResponseTime(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-10 font-bold font-mono text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">ms</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
                  Se genera una advertencia en el primer chequeo que supere este umbral.
                </span>
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Vencimiento Crítico SSL</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    max="60"
                    value={thresholdSslDays}
                    onChange={(e) => setThresholdSslDays(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pr-12 font-bold font-mono text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">días</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium block mt-1.5">
                  El certificado se marca "por expirar" cuando falten menos días de los establecidos.
                </span>
              </div>
            </div>
          </div>

          {/* Form Submit button container */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <button
              id="btn-save-channels"
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              Guardar Canales
            </button>
          </div>

        </div>

      </form>

    </div>
  );
}
