import React from 'react';
import { ListFilter, Download, Trash2, AlertTriangle, ShieldCheck, FileText, Printer } from 'lucide-react';

const API_BASE =
  (window.location.protocol === 'https:' ? 'https://' : 'http://') +
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.hostname}:8000`
    : window.location.host);

export default function EventLogTable({ events, onClearEvents }) {
  const exportCsv = () => {
    if (!events || events.length === 0) return;
    const headers = ['Timestamp', 'Severity', 'Event', 'ANSI Code', 'Distance (km)', 'Latency (ms)'];
    const rows = events.map((e) => [
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
    // Opens printable analytical SCADA fault report in new browser window (ready to print to PDF)
    window.open(`${API_BASE}/api/export-report?format=html`, '_blank');
  };

  const exportJsonReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/export-report?format=json`);
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
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col">
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-2 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">SEQUENCE OF EVENTS (SOE) / SCADA ALARM LOG</span>
          <span className="text-[10px] text-slate-400 px-1.5 py-0.2 bg-slate-900 rounded">
            {events.length} Events
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Module 3: Analytical Fault Report Buttons */}
          <button
            onClick={exportHtmlReport}
            title="Open printable SCADA Analytical Fault Report (Save as PDF)"
            className="flex items-center gap-1 px-2.5 py-1 bg-sky-900/80 hover:bg-sky-800 border border-sky-700/60 text-sky-200 rounded text-[11px] font-bold shadow-sm transition-colors"
          >
            <Printer className="w-3 h-3 text-sky-300" />
            <span>EXPORT REPORT (PDF)</span>
          </button>

          <button
            onClick={exportJsonReport}
            title="Download structured JSON report for EMS/Historian integration"
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-[11px] transition-colors"
          >
            <FileText className="w-3 h-3 text-amber-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={events.length === 0}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 rounded text-[11px] transition-colors"
          >
            <Download className="w-3 h-3 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={onClearEvents}
            disabled={events.length === 0}
            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-300 rounded text-[11px] transition-colors"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
            <span>CLEAR</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="max-h-48 overflow-y-auto border border-slate-800 rounded bg-[#070b12]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 text-[10px] uppercase border-b border-slate-800 sticky top-0 z-10">
              <th className="py-1.5 px-2">Timestamp (UTC)</th>
              <th className="py-1.5 px-2">Sev</th>
              <th className="py-1.5 px-2">ANSI Code</th>
              <th className="py-1.5 px-2">Event Description</th>
              <th className="py-1.5 px-2 text-right">Distance</th>
              <th className="py-1.5 px-2 text-right">Trip Latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {events.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-4 text-center text-slate-400 italic">
                  No protection trip alarms or sequence events recorded yet. Ready.
                </td>
              </tr>
            ) : (
              events.map((e, idx) => {
                const isTrip = e.severity === 'TRIP';
                const isWarn = e.severity === 'WARNING';
                const isNormal = e.severity === 'NORMAL';

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-900/50 transition-colors ${
                      isTrip ? 'bg-red-950/20 text-red-200' : ''
                    }`}
                  >
                    <td className="py-1 px-2 text-slate-400 whitespace-nowrap">{e.timestamp}</td>
                    <td className="py-1 px-2 whitespace-nowrap">
                      <span
                        className={`px-1 py-0.2 rounded text-[9px] font-bold ${
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
                    <td className="py-1 px-2 text-sky-400 whitespace-nowrap font-bold">
                      {e.ansi || '-'}
                    </td>
                    <td className="py-1 px-2 font-medium">{e.message}</td>
                    <td className="py-1 px-2 text-right text-amber-300">
                      {e.distance ? `${e.distance} km` : '-'}
                    </td>
                    <td className="py-1 px-2 text-right text-sky-300">
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
  );
}
