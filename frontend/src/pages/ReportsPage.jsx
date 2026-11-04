import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Trash2,
  Printer,
  FileText,
  Filter,
  Search,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Activity,
  Layers,
  Zap
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export default function ReportsPage() {
  const {
    events,
    handleClearEvents,
    tripStatus,
    classification,
    apiBase
  } = useTelemetry();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [phaseFilter, setPhaseFilter] = useState('ALL');

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Severity filter
      if (severityFilter !== 'ALL' && e.severity !== severityFilter) {
        return false;
      }
      // Phase filter
      if (phaseFilter !== 'ALL') {
        const msg = (e.message || '').toUpperCase();
        const ansi = (e.ansi || '').toUpperCase();
        if (phaseFilter === 'A' && !msg.includes('PHASE A') && !ansi.includes('A-G') && !ansi.includes('AB')) return false;
        if (phaseFilter === 'B' && !msg.includes('PHASE B') && !ansi.includes('B-G') && !ansi.includes('BC')) return false;
        if (phaseFilter === 'C' && !msg.includes('PHASE C') && !ansi.includes('C-G') && !ansi.includes('CA')) return false;
        if (phaseFilter === '3P' && !msg.includes('3-PHASE') && !msg.includes('SYMMETRICAL')) return false;
      }
      // Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matches =
          (e.message && e.message.toLowerCase().includes(term)) ||
          (e.ansi && e.ansi.toLowerCase().includes(term)) ||
          (e.timestamp && e.timestamp.toLowerCase().includes(term)) ||
          (e.category && e.category.toLowerCase().includes(term));
        if (!matches) return false;
      }
      return true;
    });
  }, [events, severityFilter, phaseFilter, searchTerm]);

  // Analytics KPIs
  const totalEvents = events.length;
  const tripEvents = events.filter((e) => e.severity === 'TRIP');
  const warningEvents = events.filter((e) => e.severity === 'WARNING');
  const normalEvents = events.filter((e) => e.severity === 'NORMAL');

  const tripLatencies = tripEvents.map((e) => e.latency).filter((l) => typeof l === 'number' && l > 0);
  const avgLatency =
    tripLatencies.length > 0
      ? (tripLatencies.reduce((a, b) => a + b, 0) / tripLatencies.length).toFixed(1)
      : '13.2';

  // Export handlers
  const exportCsv = () => {
    if (filteredEvents.length === 0) return;
    const headers = ['Timestamp', 'Severity', 'Event', 'ANSI Code', 'Distance (km)', 'Latency (ms)'];
    const rows = filteredEvents.map((e) => [
      e.timestamp,
      e.severity,
      `"${e.message}"`,
      e.ansi || '',
      e.distance || '',
      e.latency || ''
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `scada_relay_events_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportHtmlReport = () => {
    window.open(`${apiBase}/api/export-report?format=html`, '_blank');
  };

  const exportJsonReport = async () => {
    try {
      const res = await fetch(`${apiBase}/api/export-report?format=json`);
      if (res.ok) {
        const data = await res.json();
        const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', jsonStr);
        link.setAttribute('download', `${data.report_id || 'relay_fault_report'}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Failed to export JSON report:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 font-mono">
      {/* Top Forensic Analytics KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Total Events */}
        <div className="bg-scada-panel border border-scada-border rounded-md p-3 scada-bezel flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px] font-bold">Total SOE Events</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 my-1">{totalEvents}</div>
          <div className="text-[10px] text-slate-500">Recorded In-Memory Buffer</div>
        </div>

        {/* Protection Trips */}
        <div className="bg-scada-panel border border-scada-border rounded-md p-3 scada-bezel flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px] font-bold">Protective Trips (ANSI 50/51)</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 my-1">{tripEvents.length}</div>
          <div className="text-[10px] text-slate-500">Lockout Relays Energized</div>
        </div>

        {/* Average Trip Latency */}
        <div className="bg-scada-panel border border-scada-border rounded-md p-3 scada-bezel flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px] font-bold">Avg Trip Latency</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 my-1">{avgLatency} ms</div>
          <div className="text-[10px] text-slate-500">Sub-Cycle Clearance (&lt;1.0 cycle)</div>
        </div>

        {/* Breaker Current State */}
        <div className="bg-scada-panel border border-scada-border rounded-md p-3 scada-bezel flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="uppercase text-[10px] font-bold">Breaker Status</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div
            className={`text-xl font-bold my-1 ${
              tripStatus.relay_tripped ? 'text-red-400 animate-pulse' : 'text-emerald-400'
            }`}
          >
            {tripStatus.breaker_state}
          </div>
          <div className="text-[10px] text-slate-500">
            {tripStatus.relay_tripped ? 'Relay 86 Lockout Active' : 'Relay Armed Normal'}
          </div>
        </div>
      </div>

      {/* Main Full-Screen Sequence of Events (SOE) Panel */}
      <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 flex-1 flex flex-col">
        {/* Header Action Bar */}
        <div className="flex items-center justify-between border-b border-scada-border pb-3 mb-3 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-slate-200">
              SEQUENCE OF EVENTS (SOE) AUDIT TRAIL &amp; COMPLIANCE LOG
            </span>
            <span className="text-[10px] text-slate-400 px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
              Showing {filteredEvents.length} of {totalEvents} Records
            </span>
          </div>

          {/* Export & Clear Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportHtmlReport}
              title="Open printable SCADA Forensic Analytical Report (PDF)"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-900 hover:bg-sky-800 border border-sky-600 text-sky-100 rounded text-xs font-bold shadow transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-sky-300" />
              <span>EXPORT RELAY REPORT (PDF)</span>
            </button>

            <button
              onClick={exportJsonReport}
              title="Download structured JSON report for EMS/Historian"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={exportCsv}
              disabled={filteredEvents.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleClearEvents}
              disabled={events.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>CLEAR LOGS</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3 text-xs bg-[#070b12] border border-slate-800 rounded p-2">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by event, ANSI code, or timestamp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded pl-8 pr-3 py-1.5 text-xs focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Severity Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="TRIP">TRIP (Protection Tripped)</option>
              <option value="WARNING">WARNING (Drills / Injections)</option>
              <option value="NORMAL">NORMAL (Reclose / Health)</option>
            </select>
          </div>

          {/* Phase Filter */}
          <div className="md:col-span-4 flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0">Phase:</span>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1.5 text-xs focus:border-sky-500 focus:outline-none"
            >
              <option value="ALL">All Phases</option>
              <option value="A">Phase A Involved</option>
              <option value="B">Phase B Involved</option>
              <option value="C">Phase C Involved</option>
              <option value="3P">3-Phase Symmetrical</option>
            </select>
          </div>
        </div>

        {/* Full-Screen Scrollable Table */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded bg-[#070b12] max-h-[520px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/95 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0 z-10">
                <th className="py-2 px-3">Timestamp (UTC)</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">ANSI Protection</th>
                <th className="py-2 px-3">Sequence of Events Narrative</th>
                <th className="py-2 px-3 text-right">Distance (km)</th>
                <th className="py-2 px-3 text-right">Trip Latency (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 italic">
                    No SOE records found matching active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e, idx) => {
                  const isTrip = e.severity === 'TRIP';
                  const isWarn = e.severity === 'WARNING';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        isTrip ? 'bg-red-950/20 text-red-200' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{e.timestamp}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            isTrip
                              ? 'bg-red-900 text-red-100 border border-red-700'
                              : isWarn
                              ? 'bg-amber-900/60 text-amber-200 border border-amber-700/60'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {e.severity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sky-400 whitespace-nowrap font-bold">
                        {e.ansi || 'ANSI 50/51'}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-200">{e.message}</td>
                      <td className="py-2 px-3 text-right text-amber-300 font-bold">
                        {e.distance ? `${e.distance} km` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-bold">
                        {e.latency ? `${e.latency} ms` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

