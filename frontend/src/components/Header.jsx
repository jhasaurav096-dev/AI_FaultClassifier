import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RotateCcw,
  Sliders,
  Cpu,
  FileSpreadsheet
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export default function Header() {
  const {
    gridTelemetry,
    tripStatus,
    connected,
    handleResetRelay
  } = useTelemetry();

  const [clock, setClock] = useState({ utc: '', local: '' });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock({
        utc: now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        local: now.toLocaleTimeString()
      });
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isLive = gridTelemetry?.is_live_external;
  const relayTripped = tripStatus?.relay_tripped;
  const breakerState = tripStatus?.breaker_state || 'CLOSED';

  const navTabClass = ({ isActive }) =>
    `flex items-center gap-2 px-3.5 py-1.5 rounded-t text-xs font-mono font-bold tracking-wider transition-all border-b-2 ${
      isActive
        ? 'bg-slate-900 text-sky-400 border-sky-400 shadow-[0_4px_12px_rgba(56,189,248,0.15)]'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border-transparent'
    }`;

  return (
    <header className="bg-scada-panel border-b border-scada-border px-3 md:px-4 pt-2.5 pb-0 flex flex-col gap-2.5 scada-bezel">
      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title & Substation Meta */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded bg-slate-900 border border-slate-700/80 text-sky-400">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                ANSI-50/51/21
              </span>
              <h1 className="font-mono font-bold text-base md:text-lg tracking-wider text-slate-100 uppercase">
                AI-FaultClassifier <span className="text-slate-400 font-normal">| Relay SCADA</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              400kV Transmission Feeder L-401 &bull; Substation West &bull; DWT db4 AI Inference
            </p>
          </div>
        </div>

        {/* Center / Right Telemetry Status Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Data Source Badge */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded text-xs font-mono">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLive ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLive ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Data Source</span>
              <span className={`text-[11px] font-semibold ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isLive ? 'LIVE UK NATIONAL GRID' : 'STOCHASTIC MODEL'}
              </span>
            </div>
          </div>

          {/* Master Relay State */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-mono font-bold transition-all ${
              relayTripped
                ? 'bg-red-950/80 border-red-500 text-red-200 animate-pulse'
                : 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
            }`}
          >
            {relayTripped ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>TRIP LOCKOUT ({breakerState})</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>RELAY ARMED ({breakerState})</span>
              </>
            )}
          </div>

          {/* Reset Button if tripped */}
          {relayTripped && (
            <button
              onClick={handleResetRelay}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold rounded shadow transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET TRIP</span>
            </button>
          )}

          {/* Clock & WebSocket Connection */}
          <div className="hidden xl:flex flex-col text-right font-mono text-[11px] text-slate-400 pl-2 border-l border-slate-800">
            <span className="text-slate-200 font-semibold">{clock.utc}</span>
            <span className="text-[10px] text-slate-500">{clock.local} (LOCAL)</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
              }`}
            />
            <span className="text-[10px] font-mono text-slate-300 uppercase">
              {connected ? 'WS LIVE' : 'WS RECONNECTING'}
            </span>
          </div>
        </div>
      </div>

      {/* Persistent SCADA Navigation Header Tabs */}
      <nav className="flex items-center gap-1 border-t border-slate-800/80 pt-1 -mb-px overflow-x-auto">
        <NavLink to="/" end className={navTabClass}>
          <Sliders className="w-3.5 h-3.5" />
          <span>[1] LIVE SCADA CONTROL</span>
        </NavLink>

        <NavLink to="/analytics" className={navTabClass}>
          <Cpu className="w-3.5 h-3.5" />
          <span>[2] DWT &amp; SIGNAL ANALYTICS</span>
        </NavLink>

        <NavLink to="/reports" className={navTabClass}>
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>[3] EVENT LOGS &amp; REPORTS</span>
        </NavLink>
      </nav>
    </header>
  );
}
