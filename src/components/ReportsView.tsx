/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Clock,
  AlertTriangle,
  BarChart3,
  Mail,
  FileSpreadsheet,
  Send,
  X
} from 'lucide-react';
import jsPDF from 'jspdf';
import { ReportSummary, ScheduledReport } from '../types';
import { api } from '../api';
import Pagination from './Pagination';

interface ReportsViewProps {
  companyName: string;
}

const DATE_RANGE_DAYS: Record<'7d' | '30d' | '90d', number> = { '7d': 7, '30d': 30, '90d': 90 };
const PAGE_SIZE = 10;

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildCsv(summary: ReportSummary, rangeLabel: string): string {
  const lines = [
    `Reporte MonitorPro,${rangeLabel}`,
    '',
    'Métrica,Valor',
    `Acuerdo SLA,${summary.slaPercentage}%`,
    `MTTR (minutos),${summary.mttrMinutes ?? 'Sin datos'}`,
    `Incidentes resueltos,${summary.resolvedCount}/${summary.totalCount}`,
    '',
    'Sitio,Uptime (%)',
    ...summary.perSiteUptime.map((s) => `${s.name.replace(/,/g, ' ')},${s.uptime}`),
  ];
  return lines.join('\n');
}

function buildPdf(summary: ReportSummary, rangeLabel: string, companyName: string): jsPDF {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('MonitorPro — Reporte de SLA', 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${companyName || 'Workspace'} · ${rangeLabel} · Generado el ${new Date().toLocaleDateString()}`, 14, y);
  y += 12;

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`Acuerdo SLA: ${summary.slaPercentage}% de sitios cumplen ≥99.9%`, 14, y);
  y += 7;
  doc.text(
    `MTTR (tiempo medio de resolución): ${summary.mttrMinutes !== null ? `${summary.mttrMinutes} minutos` : 'sin datos suficientes'}`,
    14,
    y
  );
  y += 7;
  doc.text(`Incidentes resueltos: ${summary.resolvedCount}/${summary.totalCount}`, 14, y);
  y += 12;

  doc.setFontSize(13);
  doc.text('Disponibilidad por sitio', 14, y);
  y += 8;
  doc.setFontSize(11);
  if (summary.perSiteUptime.length === 0) {
    doc.text('Sin sitios monitoreados.', 14, y);
    y += 7;
  } else {
    for (const site of summary.perSiteUptime) {
      doc.text(`${site.name}: ${site.uptime}%`, 14, y);
      y += 7;
    }
  }

  return doc;
}

export default function ReportsView({ companyName }: ReportsViewProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [sitesPage, setSitesPage] = useState(1);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedule, setSchedule] = useState<ScheduledReport | null>(null);

  useEffect(() => {
    api.reports.summary(DATE_RANGE_DAYS[dateRange]).then(setSummary);
    setSitesPage(1);
  }, [dateRange]);

  useEffect(() => {
    api.reports.getSchedule().then(({ schedule }) => setSchedule(schedule));
  }, []);

  const rangeLabel = dateRange === '7d' ? 'Últimos 7 días' : dateRange === '30d' ? 'Últimos 30 días' : 'Últimos 90 días';

  const handleExportCsv = () => {
    if (!summary) return;
    setExporting('csv');
    const csv = buildCsv(summary, rangeLabel);
    downloadBlob(`MonitorPro_SLA_Report_${dateRange}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    setExporting(null);
  };

  const handleExportPdf = () => {
    if (!summary) return;
    setExporting('pdf');
    const doc = buildPdf(summary, rangeLabel, companyName);
    doc.save(`MonitorPro_SLA_Report_${dateRange}.pdf`);
    setExporting(null);
  };

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

      {!summary ? (
        <div className="py-16 text-center text-sm text-slate-400">Cargando reporte...</div>
      ) : (
      <>
      {/* SLA summary analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* SLA Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Acuerdo SLA</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{summary.slaPercentage}% de servicios</div>
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
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {summary.mttrMinutes !== null ? `${summary.mttrMinutes} minutos` : 'Sin datos'}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">{rangeLabel}</span>
          </div>
        </div>

        {/* Total Incidents Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center gap-4 hover:border-slate-300 transition-colors">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Incidencias Resueltas</span>
            <div className="text-lg font-bold text-slate-900 mt-0.5">{summary.resolvedCount}/{summary.totalCount} Cerradas</div>
            <span className="text-[11px] text-slate-400 font-medium">{rangeLabel}</span>
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
              <p className="text-xs text-slate-500">Disponibilidad real por sitio en {rangeLabel.toLowerCase()}.</p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-500">OBJETIVO: 99.9%</span>
          </div>

          {/* Interactive Bar Chart */}
          <div className="space-y-4">
            {summary.perSiteUptime.slice((sitesPage - 1) * PAGE_SIZE, sitesPage * PAGE_SIZE).map((site) => {
              const complies = site.uptime >= 99.9;

              return (
                <div key={site.id} className="text-xs space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-800 font-bold">{site.name}</span>
                    <div className="font-mono flex items-center gap-2">
                      <span className={complies ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {site.uptime}%
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
                      style={{ width: `${Math.max(5, (site.uptime - 90) * 10)}%` }}
                      className={`h-full rounded-lg transition-all duration-500 ${
                        complies ? 'bg-indigo-600' : 'bg-rose-500'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
            {summary.perSiteUptime.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Sin sitios monitoreados todavía.</p>
            )}
          </div>

          <Pagination page={sitesPage} totalItems={summary.perSiteUptime.length} pageSize={PAGE_SIZE} onPageChange={setSitesPage} />

          <p className="text-[10px] text-slate-400 mt-5 leading-normal font-mono font-bold text-right uppercase">
            Métricas compiladas el {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Right (4 cols): Quick Exports options */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-2xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Exportar Reportes</h3>
              <p className="text-xs text-slate-500 font-medium">Descarga el reporte del rango seleccionado.</p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Los archivos contienen el SLA, MTTR, incidentes resueltos y disponibilidad por sitio para {rangeLabel.toLowerCase()}.
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                id="btn-export-pdf"
                onClick={handleExportPdf}
                disabled={exporting !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Download className={`w-3.5 h-3.5 ${exporting === 'pdf' ? 'animate-spin' : ''}`} />
                  <span>{exporting === 'pdf' ? 'Preparando PDF...' : 'Descargar PDF'}</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-400">PDF</span>
              </button>

              <button
                id="btn-export-csv"
                onClick={handleExportCsv}
                disabled={exporting !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-500 ${exporting === 'csv' ? 'animate-spin' : ''}`} />
                  <span>{exporting === 'csv' ? 'Exportando CSV...' : 'Exportar Hoja CSV'}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-600">CSV</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1 mt-4 text-left hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="font-bold text-slate-700 flex items-center gap-1.5 uppercase text-[9px] font-mono">
              <Send className="w-3 h-3" /> Envío Programado
            </span>
            <p className="font-medium">
              {schedule?.enabled
                ? `Activo: reporte ${schedule.frequency === 'weekly' ? 'semanal' : 'mensual'} a ${schedule.recipientEmail}`
                : 'Desactivado — clic para configurar el envío automático por correo.'}
            </p>
          </button>
        </div>

      </div>
      </>
      )}

      {isScheduleModalOpen && (
        <ScheduleModal
          initial={schedule}
          onClose={() => setIsScheduleModalOpen(false)}
          onSaved={(s) => {
            setSchedule(s);
            setIsScheduleModalOpen(false);
          }}
        />
      )}

    </div>
  );
}

function ScheduleModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ScheduledReport | null;
  onClose: () => void;
  onSaved: (schedule: ScheduledReport) => void;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>(initial?.frequency ?? 'weekly');
  const [recipientEmail, setRecipientEmail] = useState(initial?.recipientEmail ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { schedule } = await api.reports.updateSchedule({ enabled, frequency, recipientEmail, lastSentAt: initial?.lastSentAt ?? null });
      onSaved(schedule);
    } catch {
      setError('El correo del destinatario no es válido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
          <h3 className="font-display font-bold text-sm tracking-wide flex items-center gap-2">
            <Mail className="w-4 h-4" /> Envío Programado de Reportes
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs font-semibold">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded-xs text-indigo-600 focus:ring-indigo-600/20 w-4 h-4"
            />
            <span className="text-slate-700">Enviar reportes automáticos por correo</span>
          </label>

          <div>
            <label className="block text-slate-600 uppercase mb-1.5">Frecuencia</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white cursor-pointer"
            >
              <option value="weekly">Semanal (cada 7 días)</option>
              <option value="monthly">Mensual (cada 30 días)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 uppercase mb-1.5">Correo del destinatario</label>
            <input
              type="email"
              required={enabled}
              placeholder="equipo@miempresa.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {initial?.lastSentAt && (
            <p className="text-[11px] text-slate-400">
              Último envío: {new Date(initial.lastSentAt).toLocaleString()}
            </p>
          )}

          {error && <p className="text-[11px] text-rose-600 font-semibold">{error}</p>}

          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
