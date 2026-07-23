/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Globe, 
  Search, 
  Plus, 
  Filter, 
  Grid, 
  List, 
  Play, 
  Pause, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ExternalLink,
  Tag,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Website } from '../types';
import { useToast } from '../toast';
import { useConfirm } from '../confirm';
import Pagination from './Pagination';

const PAGE_SIZE = 10;

interface InventoryViewProps {
  websites: Website[];
  onAddWebsite: (website: Pick<Website, 'name' | 'url' | 'checkInterval' | 'tags'>) => Promise<void>;
  onEditWebsite: (website: Pick<Website, 'id' | 'name' | 'url' | 'checkInterval' | 'tags'>) => Promise<void>;
  onDeleteWebsite: (id: string) => void;
  onToggleStatus: (id: string) => void; // toggle between Up/Maintenance
  onNavigateToDetails: (id: string) => void;
}

export default function InventoryView({
  websites,
  onAddWebsite,
  onEditWebsite,
  onDeleteWebsite,
  onToggleStatus,
  onNavigateToDetails,
}: InventoryViewProps) {
  const { showToast } = useToast();
  const confirm = useConfirm();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Website['status']>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteInterval, setNewSiteInterval] = useState(30);
  const [newSiteTags, setNewSiteTags] = useState('');

  // Edit states
  const [editingSite, setEditingSite] = useState<Website | null>(null);

  // Collect all unique tags for filter dropdown
  const allTags = Array.from(new Set(websites.flatMap(w => w.tags)));

  // Filter logic
  const filteredWebsites = websites.filter(web => {
    // Search query match
    const matchesSearch = searchQuery === '' || 
      web.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      web.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      web.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));

    // Status match
    const matchesStatus = statusFilter === 'all' || web.status === statusFilter;

    // Tag match
    const matchesTag = selectedTag === 'all' || web.tags.includes(selectedTag);

    return matchesSearch && matchesStatus && matchesTag;
  });

  // Reset to page 1 whenever the filtered set changes shape so we never land on an empty page.
  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, selectedTag]);

  const pagedWebsites = filteredWebsites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName || !newSiteUrl) {
      showToast('Por favor, rellena el nombre y la dirección URL.', 'error');
      return;
    }

    try {
      await onAddWebsite({
        name: newSiteName,
        url: newSiteUrl,
        checkInterval: Number(newSiteInterval),
        tags: newSiteTags.split(',').map(t => t.trim()).filter(Boolean)
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar el sitio.', 'error');
      return;
    }

    // Reset and close
    setNewSiteName('');
    setNewSiteUrl('');
    setNewSiteInterval(30);
    setNewSiteTags('');
    setIsModalOpen(false);
  };

  const handleEditClick = (web: Website) => {
    setEditingSite(web);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;
    try {
      await onEditWebsite(editingSite);
      setEditingSite(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar el sitio.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Inventario de Sitios</h1>
          <p className="text-sm text-slate-500">Configuración, intervalos de prueba e historial de conexiones.</p>
        </div>
        <button
          id="btn-add-site"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Sitio</span>
        </button>
      </div>

      {/* Filter and View Mode Row */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Search input (local to this view) */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, URL o etiqueta..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-all w-56"
            />
          </div>

          {/* Status Filter buttons */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs">
            {(['all', 'up', 'down', 'degraded', 'protected', 'maintenance'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md font-semibold uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-white text-indigo-600 shadow-3xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status === 'all' ? 'Todos' : status === 'protected' ? 'Protegidos' : status}
              </button>
            ))}
          </div>

          {/* Tag Filter dropdown */}
          <div className="relative">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold px-3 py-1.5 rounded-lg focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Etiqueta: Todas</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              viewMode === 'grid' 
                ? 'bg-slate-100 border-slate-300 text-slate-800' 
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
            title="Vista de cuadrícula"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              viewMode === 'list' 
                ? 'bg-slate-100 border-slate-300 text-slate-800' 
                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
            }`}
            title="Vista de lista"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pagedWebsites.map((web) => (
            <div 
              key={web.id}
              className="bg-white border border-slate-200 rounded-xl shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden group"
            >
              {/* Card Header Status */}
              <div className="px-5 py-4 border-b border-slate-100/80 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer text-sm line-clamp-1" onClick={() => onNavigateToDetails(web.id)}>
                    {web.name}
                  </h3>
                  <a href={web.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-slate-400 font-mono flex items-center gap-1 hover:text-indigo-500 mt-0.5">
                    {web.url.replace('https://', '')}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                {/* Status Badge */}
                <div>
                  {web.status === 'up' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Up
                    </span>
                  )}
                  {web.status === 'degraded' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-700 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Deg
                    </span>
                  )}
                  {web.status === 'protected' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-700 uppercase" title="Cloudflare responde, pero impide validar el contenido del portal">
                      <ShieldAlert className="w-3 h-3" /> Protegido
                    </span>
                  )}
                  {web.status === 'maintenance' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Pausado
                    </span>
                  )}
                  {web.status === 'down' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-100 text-rose-700 uppercase animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Down
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body Metrics */}
              <div className="p-5 space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Uptime 30d</span>
                    <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">{web.uptime30d}%</div>
                  </div>
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">Respuesta</span>
                    <div className="text-sm font-bold font-mono text-slate-800 mt-0.5">
                      {web.responseTime > 0 ? `${web.responseTime}ms` : '--'}
                    </div>
                  </div>
                </div>

                {/* SSL indicators */}
                <div className="space-y-2 text-[11px] text-slate-500 font-medium">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Frecuencia: Cada {web.checkInterval}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {web.sslStatus === 'valid' && (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>SSL válido: Expiración en {web.sslExpiryDays} días</span>
                      </>
                    )}
                    {web.sslStatus === 'expiring' && (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        <span className="text-amber-600 font-bold">¡SSL expira pronto en {web.sslExpiryDays} días!</span>
                      </>
                    )}
                    {web.sslStatus === 'expired' && (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        <span className="text-rose-600 font-bold">¡SSL expiró hace {Math.abs(web.sslExpiryDays)} días!</span>
                      </>
                    )}
                    {web.sslStatus === 'none' && (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400">Sin SSL verificado</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags block */}
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                  {web.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/60 rounded text-[10px] text-indigo-700 font-semibold font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>

              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100/80 flex items-center justify-between">
                
                {/* Pause/Resume toggler */}
                <button
                  onClick={() => onToggleStatus(web.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                    web.status === 'maintenance'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  title={web.status === 'maintenance' ? 'Reanudar Monitoreo' : 'Pausar Monitoreo'}
                >
                  {web.status === 'maintenance' ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                      <span>Activar</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-slate-500 text-slate-500" />
                      <span>Pausar</span>
                    </>
                  )}
                </button>

                {/* Right controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEditClick(web)}
                    className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-md hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer"
                    title="Editar Sitio"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm(`¿Estás seguro de que deseas eliminar "${web.name}"? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })) {
                        onDeleteWebsite(web.id);
                        showToast(`"${web.name}" eliminado.`, 'success');
                      }
                    }}
                    className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-md hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                    title="Eliminar Sitio"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateToDetails(web.id)}
                    className="p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors cursor-pointer"
                    title="Analizar"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            </div>
          ))}

          {filteredWebsites.length === 0 && (
            <div className="col-span-full py-16 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
              <Globe className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Ningún sitio coincide con los filtros</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">Prueba a limpiar la barra de búsqueda o cambiar el filtro de estado actual.</p>
              <button 
                onClick={() => { setStatusFilter('all'); setSelectedTag('all'); }} 
                className="mt-4 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Limpiar Filtros
              </button>
            </div>
          )}
        </div>
      ) : null}
      {viewMode === 'grid' && filteredWebsites.length > 0 && (
        <Pagination page={page} totalItems={filteredWebsites.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
      {viewMode === 'list' && (
        /* List View */
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold">
                  <th className="p-4 font-semibold">SITIO / URL</th>
                  <th className="p-4 font-semibold">ESTADO</th>
                  <th className="p-4 font-semibold text-center">UPTIME 24h</th>
                  <th className="p-4 font-semibold text-center">UPTIME 30d</th>
                  <th className="p-4 font-semibold text-center">LATENCIA</th>
                  <th className="p-4 font-semibold">INTERVALO</th>
                  <th className="p-4 font-semibold text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedWebsites.map((web) => (
                  <tr key={web.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onNavigateToDetails(web.id)}>
                        {web.name}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">{web.url}</span>
                    </td>
                    <td className="p-4">
                      {web.status === 'up' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Up
                        </span>
                      )}
                      {web.status === 'degraded' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-100 text-amber-700 uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Deg
                        </span>
                      )}
                      {web.status === 'protected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 border border-sky-200 text-sky-700 uppercase" title="Cloudflare responde, pero impide validar el contenido del portal">
                          <ShieldAlert className="w-3 h-3" /> Protegido
                        </span>
                      )}
                      {web.status === 'maintenance' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Pausado
                        </span>
                      )}
                      {web.status === 'down' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-100 text-rose-700 uppercase animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Down
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-slate-800">{web.uptime24h}%</td>
                    <td className="p-4 text-center font-mono font-bold text-slate-800">{web.uptime30d}%</td>
                    <td className="p-4 text-center font-mono font-bold text-indigo-600">{web.responseTime > 0 ? `${web.responseTime}ms` : '--'}</td>
                    <td className="p-4 font-mono text-slate-500">Cada {web.checkInterval}s</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onToggleStatus(web.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                        >
                          {web.status === 'maintenance' ? 'Iniciar' : 'Pausar'}
                        </button>
                        <button
                          onClick={() => onNavigateToDetails(web.id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
                        >
                          Ver
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirm(`¿Estás seguro de que deseas eliminar "${web.name}"? Esta acción no se puede deshacer.`, { danger: true, confirmLabel: 'Eliminar' })) {
                              onDeleteWebsite(web.id);
                              showToast(`"${web.name}" eliminado.`, 'success');
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={page} totalItems={filteredWebsites.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      )}

      {/* Add Website Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Añadir Nuevo Sitio Sintético</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Nombre del Sitio</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Portal de Administración"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Dirección URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://admin.miempresa.com"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Intervalo de Prueba</label>
                <select
                  value={newSiteInterval}
                  onChange={(e) => setNewSiteInterval(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value={30}>Cada 30s (Súper rápido)</option>
                  <option value={60}>Cada 60s (Estándar)</option>
                  <option value={300}>Cada 5min (Ahorro)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Etiquetas (Separadas por comas)</label>
                <input
                  type="text"
                  placeholder="Ej. SaaS, Frontend, Interno"
                  value={newSiteTags}
                  onChange={(e) => setNewSiteTags(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Guardar Sitio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Website Modal Popup */}
      {editingSite && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <h3 className="font-display font-bold text-sm tracking-wide">Editar Sitio: {editingSite.name}</h3>
              <button onClick={() => setEditingSite(null)} className="text-slate-400 hover:text-white transition-colors cursor-pointer font-bold text-lg">&times;</button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Nombre del Sitio</label>
                <input
                  type="text"
                  required
                  value={editingSite.name}
                  onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Dirección URL</label>
                <input
                  type="url"
                  required
                  value={editingSite.url}
                  onChange={(e) => setEditingSite({ ...editingSite, url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 uppercase mb-1.5">Intervalo de Prueba</label>
                <select
                  value={editingSite.checkInterval}
                  onChange={(e) => setEditingSite({ ...editingSite, checkInterval: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value={30}>Cada 30s</option>
                  <option value={60}>Cada 60s</option>
                  <option value={300}>Cada 5min</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
