/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileBarChart, 
  Download, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  BarChart3, 
  ChevronRight, 
  Server,
  Mail,
  FileSpreadsheet
} from 'lucide-react';
import { Website, Incident } from '../types';

interface ReportsViewProps {
  websites: Website[];
  incidents: Incident[];
}

export default function ReportsView({ websites, incidents }: ReportsViewProps) {
  
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);

  const handleExport = (type: 'pdf' | 'csv') => {
    setExporting(type);
    
    // Simulate compilation of analytical report
    setTimeout(() => {
      setExporting(null);
      alert(`¡Reporte generado con éxito! El archivo MonitorPro_SLA_Report_${dateRange}.${type} ha sido descargado en tu navegador.`);
    }, 1800);
  };

  // Metric computations
  const totalIncidentsCount = incidents.length;
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
  
  // Calculate average response time
  const activeWebs = websites.filter(w => w.status === 'up' || w.status === 'degraded');
  const avgLatency = activeWebs.length > 0
    ? Math.round(activeWebs.reduce((sum, w) => sum + w.responseTime, 0) / activeWebs.length)
    : 140;

  // Mean Time to Resolution (MTTR) simulation
  const mttrLabel = "16.4 minutos";

  // Uptime target threshold checking
  const meetingSlaCount = websites.filter(w => w.uptime30d >= 99.9).length;
  const slaPercentage = Math.round((meetingSlaCount / websites.length) * 100);

  return (
    <div className="space-y-6 font-sans text-slate-800">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Centro de Reportes</h1>
          <p className="text-sm text-slate-500">Auditoría de acuerdos de nivel de servicio (SLA) e informes de latencia.</p>
        </div>

        {/* Date presets selection */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 text-xs">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-md font-semibold uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
                dateRange === range 
                  ? 'bg-white text-indigo-600 shadow-3xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {range === '7d' ? 'Últimos 7 días' : range === '30d' ? 'Últimos 30 días' : 'Últimos 90 días'}
            </button>
          ))}
        </div>
      </div>

      {/* SLA summary analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* SLA Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Acuerdo SLA</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{slaPercentage}% de servicios</div>
            <span className="text-[11px] text-slate-400 font-medium">Cumplen el objetivo de &ge;99.9%</span>
          </div>
        </div>

        {/* MTTR Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">MTTR (Resolución)</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{mttrLabel}</div>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
              &darr; 4.2% más rápido que el mes pasado
            </span>
          </div>
        </div>

        {/* Total Incidents Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Incidencias Resueltas</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{resolvedIncidents.length}/{totalIncidentsCount} Cerradas</div>
            <span className="text-[11px] text-slate-400 font-medium">Historial acumulado</span>
          </div>
        </div>

      </div>

      {/* Main Report Visual layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left (8 cols): Interactive SVG Bar Chart showing SLA comparisons */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-2xs p-5">
          <div className="border-b border-slate-100 pb-3 mb-5 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cumplimiento de Uptime (%)</h3>
              <p className="text-xs text-slate-500">Distribución de disponibilidad mensual por sitio.</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-500">OBJETIVO: 99.9%</span>
          </div>

          {/* Interactive Bar Chart */}
          <div className="space-y-4">
            {websites.map((web) => {
              const complies = web.uptime30d >= 99.9;
              
              return (
                <div key={web.id} className="text-xs space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-800 font-bold">{web.name}</span>
                    <div className="font-mono flex items-center gap-2">
                      <span className={complies ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {web.uptime30d}%
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className={`font-bold ${complies ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {complies ? 'CUMPLE' : 'CRÍTICO'}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full h-3.5 bg-slate-100 rounded-lg overflow-hidden flex">
                    {/* Map values from 90% to 100% for better visual resolution */}
                    <div 
                      style={{ width: `${Math.max(5, (web.uptime30d - 90) * 10)}%` }}
                      className={`h-full rounded-lg transition-all duration-500 ${
                        complies ? 'bg-indigo-600' : 'bg-rose-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 mt-5 leading-normal font-mono font-bold text-right uppercase">
            Métricas compiladas el {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Right (4 cols): Quick Exports options */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Exportar Reportes</h3>
              <p className="text-xs text-slate-500 font-medium">Descarga auditorías oficiales preparadas para dirección.</p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Los archivos contienen el log detallado de sondas de prueba, latencias horarias y registro de incidentes asociados para cumplimiento de regulaciones ISO 27001.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                id="btn-export-pdf"
                onClick={() => handleExport('pdf')}
                disabled={exporting !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download className={`w-3.5 h-3.5 ${exporting === 'pdf' ? 'animate-spin' : ''}`} />
                  <span>{exporting === 'pdf' ? 'Preparando PDF...' : 'Descargar PDF Formal'}</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-400">PDF</span>
              </button>

              <button
                id="btn-export-csv"
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-500 ${exporting === 'csv' ? 'animate-spin' : ''}`} />
                  <span>{exporting === 'csv' ? 'Exportando CSV...' : 'Exportar Hoja CSV (Raw)'}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-600">CSV</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1 mt-4">
            <span className="font-bold text-slate-700 block uppercase text-[9px] font-mono">Envío Programado</span>
            <p className="font-medium">Laura Martínez recibe copias automáticas en su correo de forma mensual.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
