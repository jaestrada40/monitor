/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Pencil,
  X,
  KeyRound,
  ShieldOff
} from 'lucide-react';
import { WorkspaceSettings, UserRole, UserSession } from '../types';
import { AdminUser } from '../api';
import { resolveAvatarUrl } from '../avatar';
import { useToast } from '../toast';
import { useConfirm } from '../confirm';
import Pagination from './Pagination';

const PAGE_SIZE = 10;

interface SettingsViewProps {
  settings: WorkspaceSettings;
  onSaveSettings: (settings: WorkspaceSettings) => void;
  users: AdminUser[];
  onAddUser: (data: { email: string; username: string; role: UserRole }) => Promise<{ temporaryPassword: string; emailSent: boolean }>;
  onUpdateUser: (id: string, data: Partial<{ username: string; role: UserRole }>) => Promise<void>;
  onRemoveUser: (id: string) => Promise<void>;
  currentUserId: string;
  user: UserSession;
  onMfaSetup: () => Promise<{ secret: string; qrCodeDataUrl: string }>;
  onMfaVerifySetup: (token: string) => Promise<void>;
  onMfaDisable: (token: string) => Promise<void>;
}

export default function SettingsView({
  settings, onSaveSettings, users, onAddUser, onUpdateUser, onRemoveUser, currentUserId,
  user, onMfaSetup, onMfaVerifySetup, onMfaDisable,
}: SettingsViewProps) {
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Local state initialized with current props
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [timezone, setTimezone] = useState(settings.timezone);

  // Add-member form state (uncommitted input only; the real user list lives in the `users` prop)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('editor');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [roleUpdateError, setRoleUpdateError] = useState<string | null>(null);

  // Edit-member modal state
  const [editingMember, setEditingMember] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('editor');
  const [editSaving, setEditSaving] = useState(false);

  // MFA setup modal state
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [mfaSetupCode, setMfaSetupCode] = useState('');
  const [mfaSetupSaving, setMfaSetupSaving] = useState(false);
  const [mfaSetupError, setMfaSetupError] = useState('');

  // MFA disable modal state
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaDisableSaving, setMfaDisableSaving] = useState(false);
  const [mfaDisableError, setMfaDisableError] = useState('');

  const [membersPage, setMembersPage] = useState(1);
  const pagedUsers = users.slice((membersPage - 1) * PAGE_SIZE, membersPage * PAGE_SIZE);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      companyName,
      timezone,
      members: settings.members
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) {
      showToast('Por favor, ingresa el nombre y email del nuevo miembro.', 'error');
      return;
    }

    try {
      const { temporaryPassword, emailSent } = await onAddUser({ email: newMemberEmail, username: newMemberName, role: newMemberRole });
      showToast(
        emailSent
          ? `Usuario creado. Se envió un correo de bienvenida a ${newMemberEmail} con su contraseña temporal.`
          : `Usuario creado, pero no se pudo enviar el correo de bienvenida (SMTP no configurado). Contraseña temporal: ${temporaryPassword}`,
        emailSent ? 'success' : 'info'
      );
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('editor');
      setShowAddMember(false);
    } catch {
      showToast('No se pudo crear el usuario. Inténtalo de nuevo.', 'error');
    }
  };

  const handleRoleChange = async (id: string, role: UserRole) => {
    setRoleUpdateError(null);
    try {
      await onUpdateUser(id, { role });
    } catch {
      setRoleUpdateError('No se pudo actualizar el rol de este usuario.');
    }
  };

  const openEditMember = (member: AdminUser) => {
    setEditingMember(member);
    setEditName(member.username);
    setEditRole(member.role);
  };

  const handleEditMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditSaving(true);
    try {
      await onUpdateUser(editingMember.id, { username: editName, role: editRole });
      setEditingMember(null);
      showToast('Usuario actualizado.', 'success');
    } catch {
      showToast('No se pudo actualizar el usuario. Inténtalo de nuevo.', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemoveUser = async (id: string) => {
    const member = users.find(m => m.id === id);
    const ok = await confirm(`¿Eliminar a ${member?.username} de este workspace? Esta acción no se puede deshacer.`, {
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await onRemoveUser(id);
      showToast(`${member?.username} eliminado del workspace.`, 'success');
    } catch {
      showToast('No se pudo eliminar al usuario. Inténtalo de nuevo.', 'error');
    }
  };

  const openMfaSetup = async () => {
    setShowMfaSetup(true);
    setMfaSetupError('');
    setMfaSetupCode('');
    try {
      const data = await onMfaSetup();
      setMfaSetupData(data);
    } catch {
      setMfaSetupError('No se pudo iniciar la configuración de MFA. Inténtalo de nuevo.');
    }
  };

  const closeMfaSetup = () => {
    setShowMfaSetup(false);
    setMfaSetupData(null);
    setMfaSetupCode('');
    setMfaSetupError('');
  };

  const handleMfaSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaSetupCode.length !== 6) return;
    setMfaSetupError('');
    setMfaSetupSaving(true);
    try {
      await onMfaVerifySetup(mfaSetupCode);
      showToast('Autenticación en dos pasos activada.', 'success');
      closeMfaSetup();
    } catch {
      setMfaSetupError('Código incorrecto. Verifica tu app de autenticación e intenta de nuevo.');
      setMfaSetupCode('');
    } finally {
      setMfaSetupSaving(false);
    }
  };

  const closeMfaDisable = () => {
    setShowMfaDisable(false);
    setMfaDisableCode('');
    setMfaDisableError('');
  };

  const handleMfaDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaDisableCode.length !== 6) return;
    setMfaDisableError('');
    setMfaDisableSaving(true);
    try {
      await onMfaDisable(mfaDisableCode);
      showToast('Autenticación en dos pasos desactivada.', 'success');
      closeMfaDisable();
    } catch {
      setMfaDisableError('Código incorrecto. Inténtalo de nuevo.');
      setMfaDisableCode('');
    } finally {
      setMfaDisableSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Ajustes del Workspace</h1>
          <p className="text-sm text-slate-500 font-medium">Administra la configuración general de la organización y los roles del equipo.</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>¡Configuración general de MonitorPro actualizada y salvada con éxito!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-3xl space-y-5">

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

            {roleUpdateError && (
              <p className="text-[11px] font-semibold text-rose-600 mb-2">{roleUpdateError}</p>
            )}

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
                  {pagedUsers.map((mem) => (
                    <tr key={mem.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={resolveAvatarUrl(mem)}
                            alt={mem.username}
                            className="w-7 h-7 rounded-full border border-slate-200 object-cover shrink-0"
                          />
                          <span className="font-bold text-slate-900">{mem.username}</span>
                        </div>
                      </td>
                      <td className="py-3 font-medium text-slate-500 font-mono text-[11px]">{mem.email}</td>
                      <td className="py-3">
                        {mem.id === currentUserId ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold font-mono ${
                            mem.role === 'super-admin'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200/50'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200/50'
                          }`}>
                            {mem.role}
                          </span>
                        ) : (
                          <select
                            value={mem.role}
                            onChange={(e) => handleRoleChange(mem.id, e.target.value as UserRole)}
                            className={`px-2 py-1 rounded text-[10px] uppercase font-bold font-mono cursor-pointer border ${
                              mem.role === 'super-admin'
                                ? 'bg-purple-100 text-purple-800 border-purple-200/50'
                                : 'bg-indigo-100 text-indigo-800 border-indigo-200/50'
                            }`}
                          >
                            <option value="super-admin">super-admin</option>
                            <option value="editor">editor</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditMember(mem)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            title="Editar Usuario"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {mem.id !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(mem.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Eliminar del Workspace"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={membersPage} totalItems={users.length} pageSize={PAGE_SIZE} onPageChange={setMembersPage} />
          </div>

          {/* Security / MFA card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
            <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  Autenticación en Dos Pasos (MFA)
                </h3>
                <p className="text-xs text-slate-500 font-medium">Protege tu cuenta ({user.email}) con un código de tu app de autenticación (Google Authenticator, Authy, etc).</p>
              </div>

              {user.mfaEnabled ? (
                <span className="px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200/50 flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Activo
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold font-mono bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                  Inactivo
                </span>
              )}
            </div>

            {user.mfaEnabled ? (
              <button
                type="button"
                onClick={() => setShowMfaDisable(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                <span>Desactivar MFA</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={openMfaSetup}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Activar MFA</span>
              </button>
            )}
          </div>

          {/* Form controls save */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <button
              id="btn-save-settings"
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              Guardar Cambios
            </button>
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
                  onChange={(e) => setNewMemberRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="super-admin">Super Admin (Control total del workspace)</option>
                  <option value="editor">Editor (Soporta ediciones y pings)</option>
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

      {/* Edit Member Popup Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Editar Usuario</h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditMemberSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatarUrl(editingMember)}
                  alt={editingMember.username}
                  className="w-12 h-12 rounded-full border border-slate-200 object-cover"
                />
                <span className="text-slate-500 font-mono text-[11px]">{editingMember.email}</span>
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Rol de Workspace</label>
                <select
                  value={editRole}
                  disabled={editingMember.id === currentUserId}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="super-admin">Super Admin (Control total del workspace)</option>
                  <option value="editor">Editor (Soporta ediciones y pings)</option>
                </select>
                {editingMember.id === currentUserId && (
                  <span className="text-[10px] text-slate-400 font-medium block mt-1.5">No puedes cambiar tu propio rol.</span>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold cursor-pointer"
                >
                  {editSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Setup Modal */}
      {showMfaSetup && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Activar Autenticación en Dos Pasos</h3>
              <button onClick={closeMfaSetup} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMfaSetupSubmit} className="p-6 space-y-4 text-xs font-semibold">
              {mfaSetupData ? (
                <>
                  <p className="text-slate-600 font-medium">Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc).</p>
                  <div className="flex justify-center">
                    <img src={mfaSetupData.qrCodeDataUrl} alt="Código QR de MFA" className="w-40 h-40 border border-slate-200 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-slate-600 uppercase mb-1.5">O ingresa esta clave manualmente</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-[11px] text-slate-800 break-all select-all">
                      {mfaSetupData.secret}
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 uppercase mb-1.5">Código de verificación</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      maxLength={6}
                      value={mfaSetupCode}
                      onChange={(e) => setMfaSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 tracking-[0.3em] focus:outline-hidden"
                    />
                  </div>
                </>
              ) : !mfaSetupError ? (
                <p className="text-slate-500 font-medium">Generando código QR...</p>
              ) : null}

              {mfaSetupError && (
                <p className="text-[11px] font-semibold text-rose-600">{mfaSetupError}</p>
              )}

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={closeMfaSetup}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!mfaSetupData || mfaSetupSaving || mfaSetupCode.length !== 6}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold cursor-pointer"
                >
                  {mfaSetupSaving ? 'Verificando...' : 'Activar MFA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Disable Modal */}
      {showMfaDisable && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Desactivar Autenticación en Dos Pasos</h3>
              <button onClick={closeMfaDisable} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMfaDisableSubmit} className="p-6 space-y-4 text-xs font-semibold">
              <p className="text-slate-600 font-medium">Ingresa el código actual de tu app de autenticación para confirmar la desactivación.</p>
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Código de verificación</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={mfaDisableCode}
                  onChange={(e) => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-slate-800 tracking-[0.3em] focus:outline-hidden"
                />
              </div>

              {mfaDisableError && (
                <p className="text-[11px] font-semibold text-rose-600">{mfaDisableError}</p>
              )}

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={closeMfaDisable}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mfaDisableSaving || mfaDisableCode.length !== 6}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-lg font-bold cursor-pointer"
                >
                  {mfaDisableSaving ? 'Desactivando...' : 'Desactivar MFA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
