import React from 'react';
import { Activity, ShieldCheck, AlertOctagon, Zap, BarChart3 } from 'lucide-react';

export default function PowerQualityCard({ powerQuality }) {
  const pq = powerQuality || {
    v_thd_avg: 1.45,
    i_thd_avg: 2.30,
    ieee_519_compliant: true,
    ieee_519_status: 'COMPLIANT (IEEE 519)',
    max_v_harmonic_pct: 0.95,
    channels: {
      Va: { thd_pct: 1.4, crest_factor: 1.42, harmonics: { h3: 0.6, h5: 1.1, h7: 0.7, h9: 0.2, h11: 0.1 } },
      Vb: { thd_pct: 1.5, crest_factor: 1.41, harmonics: { h3: 0.5, h5: 1.2, h7: 0.8, h9: 0.2, h11: 0.1 } },
      Vc: { thd_pct: 1.4, crest_factor: 1.43, harmonics: { h3: 0.7, h5: 1.0, h7: 0.6, h9: 0.2, h11: 0.1 } },
      Ia: { thd_pct: 2.4, crest_factor: 1.45, harmonics: { h3: 0.9, h5: 1.8, h7: 1.1, h9: 0.3, h11: 0.2 } },
      Ib: { thd_pct: 2.2, crest_factor: 1.44, harmonics: { h3: 0.8, h5: 1.7, h7: 1.0, h9: 0.3, h11: 0.2 } },
      Ic: { thd_pct: 2.3, crest_factor: 1.46, harmonics: { h3: 0.9, h5: 1.9, h7: 1.2, h9: 0.3, h11: 0.2 } }
    },
    harmonic_spectrum: [
      { harmonic: '3rd (150Hz)', pct: 0.6, limit: 3.0 },
      { harmonic: '5th (250Hz)', pct: 1.2, limit: 3.0 },
      { harmonic: '7th (350Hz)', pct: 0.8, limit: 3.0 },
      { harmonic: '9th (450Hz)', pct: 0.2, limit: 1.5 },
      { harmonic: '11th (550Hz)', pct: 0.1, limit: 1.5 }
    ]
  };

  const isCompliant = pq.ieee_519_compliant;
  const spectrum = pq.harmonic_spectrum || [];

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">POWER QUALITY &amp; HARMONIC ANALYSIS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">FFT SPECTRUM (IEEE 519)</span>
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
              isCompliant
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-red-950/80 border-red-500/60 text-red-400 animate-pulse'
            }`}
          >
            {isCompliant ? (
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
            ) : (
              <AlertOctagon className="w-3 h-3 text-red-400" />
            )}
            <span>{isCompliant ? 'IEEE 519 COMPLIANT (<5.0%)' : 'THD VIOLATION (>5.0%)'}</span>
          </div>
        </div>
      </div>

      {/* Primary Telemetry Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {/* Voltage THD */}
        <div className="bg-[#070c18] border border-slate-800 rounded p-2 flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Voltage THD</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-bold font-mono ${
                pq.v_thd_avg <= 5.0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {pq.v_thd_avg}%
            </span>
            <span className="text-[10px] text-slate-500">lim: 5.0%</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                pq.v_thd_avg <= 5.0 ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, (pq.v_thd_avg / 8.0) * 100)}%` }}
            />
          </div>
        </div>

        {/* Current THD */}
        <div className="bg-[#070c18] border border-slate-800 rounded p-2 flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Avg Current THD</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-lg font-bold font-mono ${
                pq.i_thd_avg <= 5.0 ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {pq.i_thd_avg}%
            </span>
            <span className="text-[10px] text-slate-500">nominal</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (pq.i_thd_avg / 10.0) * 100)}%` }}
            />
          </div>
        </div>

        {/* Max Individual Harmonic */}
        <div className="bg-[#070c18] border border-slate-800 rounded p-2 flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Max Harmonic (Va)</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold font-mono text-slate-200">
              {pq.max_v_harmonic_pct}%
            </span>
            <span className="text-[10px] text-slate-500">lim: 3.0%</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Dominant: <span className="text-amber-400">5th Order (250Hz)</span>
          </div>
        </div>

        {/* Crest Factor */}
        <div className="bg-[#070c18] border border-slate-800 rounded p-2 flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Voltage Crest Factor</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-lg font-bold font-mono text-purple-400">
              {pq.channels?.Va?.crest_factor || 1.41}
            </span>
            <span className="text-[10px] text-slate-500">ideal: 1.414</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            RMS: <span className="text-slate-300">{pq.channels?.Va?.rms || 1.0} pu</span>
          </div>
        </div>
      </div>

      {/* 3-Phase Channel Breakdown & Harmonic Spectrum */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Phase Channels THD Table */}
        <div className="bg-[#070b12] border border-slate-800 rounded p-2 flex flex-col">
          <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
            <span>Phase Channel Analysis</span>
            <span>V_THD / I_THD</span>
          </div>
          <div className="flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-scada-phaseA inline-block" />
                Phase A
              </span>
              <span className="font-mono">
                V: <strong className="text-slate-200">{pq.channels?.Va?.thd_pct ?? 0}%</strong> &bull; I:{' '}
                <strong className="text-slate-300">{pq.channels?.Ia?.thd_pct ?? 0}%</strong>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-scada-phaseB inline-block" />
                Phase B
              </span>
              <span className="font-mono">
                V: <strong className="text-slate-200">{pq.channels?.Vb?.thd_pct ?? 0}%</strong> &bull; I:{' '}
                <strong className="text-slate-300">{pq.channels?.Ib?.thd_pct ?? 0}%</strong>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="w-2 h-2 rounded-full bg-scada-phaseC inline-block" />
                Phase C
              </span>
              <span className="font-mono">
                V: <strong className="text-slate-200">{pq.channels?.Vc?.thd_pct ?? 0}%</strong> &bull; I:{' '}
                <strong className="text-slate-300">{pq.channels?.Ic?.thd_pct ?? 0}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Harmonic Spectrum Bars */}
        <div className="bg-[#070b12] border border-slate-800 rounded p-2 flex flex-col justify-between">
          <div className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-1 mb-1.5 flex justify-between">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-sky-400" />
              Harmonic Orders (Va FFT)
            </span>
            <span className="text-[9px] text-slate-500">IEEE Limit</span>
          </div>

          <div className="flex flex-col gap-1.5">
            {spectrum.map((h, i) => {
              const exceeds = h.pct > h.limit;
              const barWidth = Math.min(100, (h.pct / 4.0) * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="w-16 text-slate-400 shrink-0">{h.harmonic.split(' ')[0]}</span>
                  <div className="flex-1 bg-slate-800 h-2 rounded overflow-hidden relative">
                    {/* Limit mark */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 z-10"
                      style={{ left: `${(h.limit / 4.0) * 100}%` }}
                      title={`Limit: ${h.limit}%`}
                    />
                    <div
                      className={`h-full transition-all duration-300 ${
                        exceeds ? 'bg-red-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span
                    className={`w-10 text-right font-mono font-bold shrink-0 ${
                      exceeds ? 'text-red-400' : 'text-slate-300'
                    }`}
                  >
                    {h.pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

