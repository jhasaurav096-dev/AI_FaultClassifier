import React from 'react';
import { Waves, Sparkles, HelpCircle } from 'lucide-react';
import { PHASE_COLORS } from '../utils/scadaTheme';

export default function WaveletEnergyBars({ waveletSpectrum }) {
  if (!waveletSpectrum) {
    return null;
  }

  const channels = ['Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic'];

  // Helper to format scientific or float energy
  const formatEnergy = (e) => {
    if (!e || e < 1e-4) return '0.000';
    if (e > 1000) return e.toFixed(0);
    if (e > 10) return e.toFixed(1);
    return e.toFixed(3);
  };

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col">
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">DWT SPECTRAL ENERGY MATRIX (DAUBECHIES db4)</span>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Transient Window Energy: E = &Sigma; |D_k|&sup2;
        </span>
      </div>

      {/* Grid of Spectral Bars for Channels */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {channels.map((ch) => {
          const spec = waveletSpectrum[ch] || {};
          const isCurrent = ch.startsWith('I');
          const d1 = spec.d1_high_freq || 0.0;
          const d2 = spec.d2_mid_high || 0.0;
          const d3 = spec.d3_mid_low || 0.0;
          const a = spec.a_fundamental || 0.0;
          const entropy = spec.entropy || 0.0;

          // Normalize detail energy for bar graph representation (logarithmic scale)
          const normBar = (val) => {
            if (val <= 0.001) return 4;
            const logVal = Math.log10(val + 1);
            return Math.min(100, Math.max(6, logVal * 28));
          };

          return (
            <div
              key={ch}
              className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1.5">
                <span
                  className="font-bold text-xs"
                  style={{ color: PHASE_COLORS[ch] || '#e2e8f0' }}
                >
                  {ch} ({isCurrent ? 'Current' : 'Voltage'})
                </span>
                <span className="text-[9px] text-slate-400" title="Shannon Wavelet Entropy">
                  H: {entropy.toFixed(2)}
                </span>
              </div>

              {/* Sub-bands */}
              <div className="flex flex-col gap-1.5">
                {/* D1 High Freq (Traveling Wave) */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="text-red-400 font-semibold">D1 (High-Freq)</span>
                    <span>{formatEnergy(d1)}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-red-500 transition-all duration-200"
                      style={{ width: `${normBar(d1)}%` }}
                    />
                  </div>
                </div>

                {/* D2 Mid Freq */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="text-amber-400">D2 (Mid-Transient)</span>
                    <span>{formatEnergy(d2)}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${normBar(d2)}%` }}
                    />
                  </div>
                </div>

                {/* D3 Low Transient */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="text-sky-400">D3 (Low-Band)</span>
                    <span>{formatEnergy(d3)}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-sky-500 transition-all duration-200"
                      style={{ width: `${normBar(d3)}%` }}
                    />
                  </div>
                </div>

                {/* A Fundamental */}
                <div>
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span className="text-emerald-400">A (50Hz Base)</span>
                    <span>{formatEnergy(a)}</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${normBar(a)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

