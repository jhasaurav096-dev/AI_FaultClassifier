import React from 'react';
import { Globe, Gauge, Activity, Flame, Wind, Sun, Atom } from 'lucide-react';
import { formatFrequency } from '../utils/scadaTheme';

export default function LiveGridTelemetry({ gridTelemetry }) {
  const isLive = gridTelemetry?.is_live_external;
  const freq = gridTelemetry?.grid_frequency_hz ?? 50.000;
  const carbon = gridTelemetry?.carbon_intensity_gco2_kwh ?? 142;
  const forecast = gridTelemetry?.carbon_forecast_gco2_kwh ?? 140;
  const carbonIndex = gridTelemetry?.carbon_index ?? 'moderate';
  const loadFactor = gridTelemetry?.grid_load_factor ?? 0.78;
  const stress = gridTelemetry?.grid_stress_level ?? 0.22;
  const mix = gridTelemetry?.generation_mix || {
    wind: 38.5, gas: 31.2, nuclear: 15.0, solar: 6.8, biomass: 4.5, imports: 4.0
  };

  // Frequency deviation in mHz
  const freqDevMhz = Math.round((freq - 50.000) * 1000);

  // Carbon index badge color
  const indexBadgeColor = {
    'very low': 'bg-emerald-950 text-emerald-300 border-emerald-600',
    'low': 'bg-emerald-950 text-emerald-400 border-emerald-700',
    'moderate': 'bg-amber-950 text-amber-300 border-amber-600',
    'high': 'bg-orange-950 text-orange-300 border-orange-600',
    'very high': 'bg-red-950 text-red-300 border-red-600'
  }[carbonIndex.toLowerCase()] || 'bg-slate-800 text-slate-300 border-slate-700';

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">OPEN ENERGY TELEMETRY & GRID STRESS</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${indexBadgeColor} uppercase`}>
          {carbonIndex} INTENSITY
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {/* Grid Frequency */}
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase">System Frequency</span>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="text-base font-bold text-sky-300">{formatFrequency(freq)}</span>
            <span className="text-[10px] text-slate-500">Hz</span>
          </div>
          <span className={`text-[9px] ${Math.abs(freqDevMhz) > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
            &Delta;f: {freqDevMhz > 0 ? `+${freqDevMhz}` : freqDevMhz} mHz
          </span>
        </div>

        {/* Carbon Intensity */}
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase">Carbon Intensity</span>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="text-base font-bold text-amber-300">{carbon}</span>
            <span className="text-[10px] text-slate-500">gCO2/kWh</span>
          </div>
          <span className="text-[9px] text-slate-400">
            Forecast: {forecast} g
          </span>
        </div>

        {/* System Load */}
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase">Grid Load Factor</span>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="text-base font-bold text-emerald-400">{Math.round(loadFactor * 100)}%</span>
            <span className="text-[10px] text-slate-500">Nominal</span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.round(loadFactor * 100)}%` }}
            />
          </div>
        </div>

        {/* Stress Level */}
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase">Background Stress</span>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="text-base font-bold text-sky-400">{(stress * 10).toFixed(1)}</span>
            <span className="text-[10px] text-slate-500">/ 10</span>
          </div>
          <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                stress > 0.6 ? 'bg-red-500' : stress > 0.35 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, stress * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Generation Mix Mini Progress */}
      <div className="bg-slate-900/60 border border-slate-800 p-2 rounded text-[10px] mt-auto">
        <span className="text-slate-400 font-bold block mb-1">GENERATION MIX (UK GRID):</span>
        <div className="grid grid-cols-3 gap-1 text-slate-300">
          <div><span className="text-sky-400">Wind:</span> {mix.wind}%</div>
          <div><span className="text-amber-400">Gas:</span> {mix.gas}%</div>
          <div><span className="text-emerald-400">Nuclear:</span> {mix.nuclear}%</div>
          <div><span className="text-yellow-400">Solar:</span> {mix.solar}%</div>
          <div><span className="text-lime-400">Biomass:</span> {mix.biomass}%</div>
          <div><span className="text-purple-400">Imports:</span> {mix.imports}%</div>
        </div>
      </div>
    </div>
  );
}

