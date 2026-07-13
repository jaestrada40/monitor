/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Filter, 
  RotateCw, 
  Play, 
  Zap, 
  Flame,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Incident, Website } from '../types';
import Pagination from './Pagination';

const PAGE_SIZE = 10;

interface IncidentsViewProps {
  incidents: Incident[];
  websites: Website[];
  onAcknowledgeIncident: (id: string) => void;
  onResolveIncident: (id: string) => void;
}

export default function IncidentsView({
  incidents,
  websites,
  onAcknowledgeIncident,
  onResolveIncident
}: IncidentsViewProps) {
  
  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [page, setPage] = useState(1);

  // Expanded item state
  const [expandedIncidentIds, setExpandedIncidentIds] = useState<string[]>([]);
  
  const toggleExpand = (id: string) => {
    if (expandedIncidentIds.includes(id)) {
      setExpandedIncidentIds(expandedIncidentIds.filter(x => x !== id));
    } else {
      setExpandedIncidentIds([...expandedIncidentIds, id]);
    }
  };

  // Filter logic
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = searchQuery === '' || 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.websiteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, severityFilter]);

  const pagedIncidents = filteredIncidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Registro de Incidentes</h1>
          <p className="text-sm text-slate-500">Historial completo, escalado y resolución de alarmas sintéticas.</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          
          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="incidents-search"
              type="text"
              placeholder="Buscar incidente o sitio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-hidden focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Status Select filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
            >
              <option value="all">Estado: Todos</option>
              <option value="active">Activos (Sin Aceptar)</option>
              <option value="acknowledged">Aceptados (En Investigación)</option>
              <option value="resolved">Resueltos</option>
            </select>
          </div>

          {/* Severity Select filter */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
            >
              <option value="all">Gravedad: Todas</option>
              <option value="critical">Crítico (Pérdida de Servicio)</option>
              <option value="warning">Advertencia (Degradación)</option>
              <option value="info">Información</option>
            </select>
          </div>

        </div>
      </div>

      {/* Incidents List Grid */}
      <div className="space-y-3.5">
        {pagedIncidents.map((inc) => {
          const isExpanded = expandedIncidentIds.includes(inc.id);
          
          return (
            <div 
              key={inc.id}
              className={`bg-white border rounded-xl overflow-hidden shadow-3xs hover:border-slate-300 transition-colors ${
                inc.status !== 'resolved'
                  ? inc.severity === 'critical'
                    ? 'border-l-4 border-l-rose-500 border-slate-200'
                    : 'border-l-4 border-l-amber-500 border-slate-200'
                  : 'border-slate-200'
              }`}
            >
              {/* Row Header */}
              <div 
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                onClick={() => toggleExpand(inc.id)}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-1 shrink-0">
                    {inc.status === 'resolved' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : inc.severity === 'critical' ? (
                      <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{inc.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 font-medium mt-1">
                      <span className="font-bold text-indigo-600 underline">{inc.websiteName}</span>
                      <span>&bull;</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold font-mono ${
                        inc.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : inc.severity === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {inc.severity}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono">{new Date(inc.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {inc.duration && (
                        <>
                          <span>&bull;</span>
                          <span className="font-mono text-emerald-600 font-bold">Resuelto en {inc.duration}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Controls and Expand State icon */}
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  
                  {/* Status Badge */}
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                    inc.status === 'resolved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : inc.status === 'acknowledged'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {inc.status === 'resolved' ? 'Resuelto' : inc.status === 'acknowledged' ? 'Aceptado' : 'Abierto'}
                  </span>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Collapsible Details Body */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider mb-1.5 font-mono">Descripción Técnica del Evento</h4>
                    <p className="text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-lg border border-slate-200/60 shadow-3xs">
                      {inc.description}
                    </p>
                  </div>

                  {/* Incident timelines */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono text-slate-500 pt-1">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Apertura</span>
                      <span className="font-semibold text-slate-700">{new Date(inc.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Aceptado (ACK)</span>
                      <span className="font-semibold text-indigo-600">{inc.acknowledgedAt ? new Date(inc.acknowledgedAt).toLocaleTimeString() : 'Pendiente'}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/50">
                      <span className="text-slate-400 uppercase font-bold text-[9px] block">Resolución</span>
                      <span className="font-semibold text-emerald-600">{inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString() : 'En curso'}</span>
                    </div>
                  </div>

                  {/* Manual Operational Actions */}
                  {inc.status !== 'resolved' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-100 justify-end">
                      {inc.status === 'active' && (
                        <button
                          onClick={() => onAcknowledgeIncident(inc.id)}
                          className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          Aceptar y Asignar
                        </button>
                      )}
                      <button
                        onClick={() => onResolveIncident(inc.id)}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer border border-emerald-700"
                      >
                        Marcar como Resuelto
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredIncidents.length === 0 && (
          <div className="py-16 bg-white border border-slate-200 rounded-xl text-center">
            <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No se encontraron incidentes</p>
            <p className="text-xs text-slate-400 mt-1">Intenta cambiar los filtros de búsqueda.</p>
          </div>
        )}
      </div>

      {filteredIncidents.length > 0 && (
        <Pagination page={page} totalItems={filteredIncidents.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}

    </div>
  );
}
