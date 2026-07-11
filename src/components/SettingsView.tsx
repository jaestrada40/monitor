/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Settings, 
  Users, 
  Key, 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  RefreshCw, 
  Database, 
  CreditCard, 
  Globe2,
  Check
} from 'lucide-react';
import { WorkspaceSettings, WorkspaceMember } from '../types';

interface SettingsViewProps {
  settings: WorkspaceSettings;
  onSaveSettings: (settings: WorkspaceSettings) => void;
}

export default function SettingsView({ settings, onSaveSettings }: SettingsViewProps) {
  
  // Local state initialized with current props
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>(settings.plan);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  
  // Member states
  const [members, setMembers] = useState<WorkspaceMember[]>(settings.members);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'viewer'>('viewer');

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      companyName,
      timezone,
      plan,
      apiKey,
      members
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const rotateApiKey = () => {
    if (confirm("¿Estás seguro de que deseas rotar la clave de API del workspace? Todas las integraciones actuales dejarán de responder hasta que actualices la clave.")) {
      const chars = 'abcdef0123456789';
      let key = 'mp_live_';
      for (let i = 0; i < 32; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
      }
      setApiKey(key);
      alert("¡Clave de API rotada con éxito! No olvides pulsar 'Guardar Configuración' para aplicar los cambios.");
    }
  };

  const handleAddMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) {
      alert("Por favor, ingresa el nombre y email del nuevo miembro.");
      return;
    }

    const newMember: WorkspaceMember = {
      id: `mem-${Date.now()}`,
      name: newMemberName,
      email: newMemberEmail,
      role: newMemberRole
    };

    setMembers([...members, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('viewer');
    setShowAddMember(false);
  };

  const deleteMember = (id: string) => {
    const member = members.find(m => m.id === id);
    if (member?.role === 'owner') {
      alert("No se puede eliminar al propietario original de la cuenta.");
      return;
    }
    if (confirm(`¿Eliminar a ${member?.name} de este workspace?`)) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Ajustes del Workspace</h1>
          <p className="text-sm text-slate-500 font-medium">Administra la configuración general de la organización, roles, facturación e integraciones API.</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>¡Configuración general de MonitorPro actualizada y salvada con éxito!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column (8 cols): Organization Settings & Members management */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* General settings card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">Información de la Organización</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Nombre de la Empresa</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Zona Horaria del Servidor</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value="Europe/Madrid (GMT+2)">Europe/Madrid (GMT+2) - España Peninsular</option>
                  <option value="Europe/London (GMT+1)">Europe/London (GMT+1) - Reino Unido</option>
                  <option value="America/New_York (GMT-4)">America/New_York (GMT-4) - EST</option>
                  <option value="Asia/Tokyo (GMT+9)">Asia/Tokyo (GMT+9) - KST/JST</option>
                </select>
              </div>
            </div>
          </div>

          {/* Members management card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Miembros del Workspace
                </h3>
                <p className="text-xs text-slate-500 font-medium">Asigna y restringe roles para mayor seguridad operativa.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invitar Miembro</span>
              </button>
            </div>

            {/* Members table */}
            <div className="overflow-x-auto text-xs font-semibold">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="pb-2 font-semibold">NOMBRE</th>
                    <th className="pb-2 font-semibold">CORREO ELECTRÓNICO</th>
                    <th className="pb-2 font-semibold">ROL ASIGNADO</th>
                    <th className="pb-2 text-right font-semibold">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((mem) => (
                    <tr key={mem.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{mem.name}</td>
                      <td className="py-3 font-medium text-slate-500 font-mono text-[11px]">{mem.email}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${
                          mem.role === 'owner' 
                            ? 'bg-purple-100 text-purple-800 border border-purple-200/50' 
                            : mem.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200/50'
                            : 'bg-slate-100 text-slate-700 border border-slate-200/50'
                        }`}>
                          {mem.role}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {mem.role !== 'owner' && (
                          <button
                            type="button"
                            onClick={() => deleteMember(mem.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Eliminar del Workspace"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Plan Billing & Developer API rotation */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Plan Billing select card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                Plan Activo
              </h3>
              <p className="text-xs text-slate-500 font-medium">Suscripción actual de tu servicio MonitorPro.</p>
            </div>

            <div className="space-y-3">
              {[
                { id: 'starter', name: 'Starter Plan', price: '$29/mes', features: '10 sitios, 60s intervalo' },
                { id: 'pro', name: 'Professional Plan', price: '$79/mes', features: '50 sitios, 30s intervalo, SMS' },
                { id: 'enterprise', name: 'Enterprise Premium', price: 'Custom', features: 'Sitios ilimitados, SLA formal, SSO' }
              ].map((tier) => {
                const isSelected = plan === tier.id;
                return (
                  <div
                    key={tier.id}
                    onClick={() => setPlan(tier.id as any)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-3xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-950 font-display">{tier.name}</span>
                      <span className="text-indigo-600 font-mono">{tier.price}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">{tier.features}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Developer API credentials card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <div className="border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-indigo-600" />
                Desarrollo e Integraciones (API)
              </h3>
              <p className="text-xs text-slate-500 font-medium">Claves para automatizar y consultar estados remotamente.</p>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Clave de API del Workspace</label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={apiKey}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-indigo-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={rotateApiKey}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Rotar Clave de API</span>
              </button>
            </div>
          </div>

          {/* Form controls save */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <button
              id="btn-save-settings"
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              Guardar Cambios
            </button>
          </div>

        </div>

      </form>

      {/* Invite Member Popup Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Invitar Nuevo Miembro</h3>
              <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleAddMemberSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Gómez"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Dirección de Email</label>
                <input
                  type="email"
                  required
                  placeholder="juan@empresa.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Rol de Workspace</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="admin">Admin (Soporta ediciones y pings)</option>
                  <option value="viewer">Viewer (Solo lectura de métricas)</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Enviar Invitación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
