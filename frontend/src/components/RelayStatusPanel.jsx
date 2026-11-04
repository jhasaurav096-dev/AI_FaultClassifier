import React from 'react';
import { AlertOctagon, CheckCircle2, ShieldAlert, Cpu, Crosshair, Zap, RotateCcw } from 'lucide-react';
import { FAULT_TAXONOMY_MAP } from '../utils/scadaTheme';

export default function RelayStatusPanel({
  classification,
  tripStatus,
  onResetRelay
}) {
  const isTripped = tripStatus?.relay_tripped;
  const breakerState = tripStatus?.breaker_state || 'CLOSED';
  const tripDetails = tripStatus?.trip_details || {};
  const clsId = classification?.class_id ?? 0;
  const meta = FAULT_TAXONOMY_MAP[clsId] || FAULT_TAXONOMY_MAP[0];

  const confidencePct = classification?.confidence_percent ?? 99.8;
  const distanceKm = classification?.estimated_distance_km ?? 0.0;
  const impedanceOhm = classification?.estimated_impedance_ohm ?? 50.0;
  const protectionZone = classification?.protection_zone ?? 'NORMAL (IN-ZONE)';
  const ansiCode = classification?.ansi_code ?? 'ANSI-NORMAL';
  const latencyMs = tripStatus?.trip_latency_ms ?? 0.0;

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel flex flex-col h-full font-mono">
      {/* Panel Top Title Bar */}
      <div className="bg-slate-900 border-b border-scada-border px-3 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">DIGITAL PROTECTION RELAY (ANSI 50/51/21)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">BREAKER:</span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
              breakerState === 'CLOSED'
                ? 'bg-emerald-950 border border-emerald-600 text-emerald-300'
                : 'bg-red-950 border border-red-500 text-red-200 animate-pulse'
            }`}
          >
            {breakerState}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Main Annunciator Banner */}
        <div
          className={`p-3.5 rounded border transition-all flex items-center gap-3.5 ${
            isTripped
              ? 'bg-red-950/70 border-red-500 text-red-100 animate-flash-trip shadow-lg shadow-red-950/40'
              : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
          }`}
        >
          {isTripped ? (
            <AlertOctagon className="w-8 h-8 text-red-400 flex-shrink-0 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-black/40 rounded border border-white/10 uppercase">
                {isTripped ? `ALARM: ${ansiCode}` : 'SYSTEM HEALTHY'}
              </span>
              {isTripped && (
                <span className="text-[10px] text-red-300">
                  LATENCY: {latencyMs} ms
                </span>
              )}
            </div>
            <div className="text-sm md:text-base font-bold truncate mt-0.5">
              {isTripped ? meta.name : 'ALL PHASES BALANCED - NORMAL OPERATION'}
            </div>
            <div className="text-xs text-slate-300/80 truncate">
              {classification?.description || 'Grid nominal 400kV steady-state telemetry'}
            </div>
          </div>
        </div>

        {/* Relay Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* AI Confidence */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase">AI Confidence</span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-lg font-bold text-sky-400">{confidencePct}%</span>
              <span className="text-[10px] text-slate-500">RF Classifier</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isTripped ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(10, confidencePct))}%` }}
              />
            </div>
          </div>

          {/* Fault Distance */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase">Fault Distance</span>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-lg font-bold ${isTripped ? 'text-amber-400' : 'text-slate-400'}`}>
                {isTripped ? `${distanceKm} km` : '0.0 km'}
              </span>
              <span className="text-[10px] text-slate-500">/ 100km</span>
            </div>
            <span className="text-[10px] text-slate-400 truncate">
              {isTripped ? protectionZone : 'Standby Reach'}
            </span>
          </div>

          {/* Fault Impedance */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase">Loop Impedance</span>
            <div className="flex items-baseline gap-1 my-1">
              <span className={`text-lg font-bold ${isTripped ? 'text-rose-400' : 'text-slate-400'}`}>
                {impedanceOhm} &Omega;
              </span>
              <span className="text-[10px] text-slate-500">Z_fault</span>
            </div>
            <span className="text-[10px] text-slate-400 truncate">
              {isTripped ? 'Arc Impedance Detected' : 'Nominal Load Impedance'}
            </span>
          </div>

          {/* Fault Category */}
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] uppercase">Taxonomy Class</span>
            <div className="my-1">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                isTripped
                  ? 'bg-red-950/60 border-red-500 text-red-300'
                  : 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
              }`}>
                {meta.code}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 truncate">
              {meta.category}
            </span>
          </div>
        </div>

        {/* Protection Zone Reach Visualizer & Breaker Control */}
        <div className="bg-slate-900/60 border border-slate-800 p-3 rounded flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">LINE PROTECTION REACH (100 KM SPAN):</span>
            <span className="text-slate-300">
              {isTripped ? `FAULT LOCATED @ ${distanceKm} KM (${Math.round((distanceKm / 100) * 100)}%)` : 'LINE NOMINAL'}
            </span>
          </div>

          {/* Visual Track */}
          <div className="relative w-full bg-slate-950 h-5 rounded border border-slate-800 overflow-hidden flex items-center">
            {/* Zone 1 indicator (0 - 80 km) */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-sky-950/40 border-r border-sky-700/60 flex items-center pl-2"
              style={{ width: '80%' }}
            >
              <span className="text-[9px] text-sky-400/80 font-bold">ZONE 1 (0-80 km instantaneous)</span>
            </div>
            {/* Zone 2 indicator (80 - 100 km) */}
            <div
              className="absolute right-0 top-0 bottom-0 bg-indigo-950/30 flex items-center pr-2 justify-end"
              style={{ width: '20%' }}
            >
              <span className="text-[9px] text-indigo-400/80 font-bold">ZONE 2</span>
            </div>

            {/* Marker if fault */}
            {isTripped && (
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-red-500 shadow-md shadow-red-500 animate-pulse z-20"
                style={{ left: `calc(${Math.min(98, Math.max(2, distanceKm))}% - 5px)` }}
                title={`Fault Location: ${distanceKm} km`}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>SUBSTATION A (0 KM)</span>
            <span>ZONE 1 REACH (80 KM)</span>
            <span>SUBSTATION B (100 KM)</span>
          </div>
        </div>

        {/* Trip Lockout Reset Action */}
        {isTripped && (
          <div className="mt-auto pt-2 flex items-center justify-between bg-red-950/30 border border-red-900/60 p-2.5 rounded">
            <div className="text-[11px] text-red-300">
              <span className="font-bold">LOCKOUT ACTIVE: </span>
              Breaker tripped to protect equipment. Manual reclose required.
            </div>
            <button
              onClick={onResetRelay}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow transition-all text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET RELAY & RECLOSE</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

