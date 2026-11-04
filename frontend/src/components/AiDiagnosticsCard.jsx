import React, { useState, useEffect } from 'react';
import { Cpu, Target, Award, BarChart2, ShieldCheck, Zap } from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';

export default function AiDiagnosticsCard() {
  const { classification, apiBase } = useTelemetry();
  const [modelMetrics, setModelMetrics] = useState(null);

  useEffect(() => {
    fetch(`${apiBase}/api/model-metrics`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setModelMetrics(data);
      })
      .catch((err) => console.warn('Failed to load model metrics:', err));
  }, [apiBase]);

  const metrics = modelMetrics || {
    accuracy_percent: 100.0,
    feature_count: 98,
    classes_count: 11,
    distance_r2: 0.36,
    distance_mae_km: 18.4,
    top_features: [
      { feature: 'V_ca_rms', importance: 0.082 },
      { feature: 'V_bc_rms', importance: 0.076 },
      { feature: 'Vb_rms', importance: 0.068 },
      { feature: 'Va_d1_energy', importance: 0.054 },
      { feature: 'I_zero_seq', importance: 0.048 },
      { feature: 'Ia_d1_energy', importance: 0.042 },
      { feature: 'Vc_rms', importance: 0.039 },
      { feature: 'Ib_d2_energy', importance: 0.035 }
    ]
  };

  const topFeats = metrics.top_features || [];
  const confidence = classification?.confidence || 99.8;

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col justify-between">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="font-bold text-slate-200">AI INFERENCE &amp; FEATURE IMPORTANCE</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
          <Award className="w-3 h-3 text-purple-400" />
          <span>ACCURACY: {metrics.accuracy_percent}%</span>
        </div>
      </div>

      {/* Model Spec Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
        <div className="bg-[#070c18] border border-slate-800 rounded p-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Architecture</span>
          <div className="text-sm font-bold text-slate-200 mt-0.5">Random Forest</div>
          <span className="text-[10px] text-slate-500">150 Estimators</span>
        </div>

        <div className="bg-[#070c18] border border-slate-800 rounded p-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">DWT Features</span>
          <div className="text-sm font-bold text-sky-400 mt-0.5">{metrics.feature_count} Dim</div>
          <span className="text-[10px] text-slate-500">Daubechies 4 (db4)</span>
        </div>

        <div className="bg-[#070c18] border border-slate-800 rounded p-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Taxonomy</span>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">{metrics.classes_count} Classes</div>
          <span className="text-[10px] text-slate-500">Normal + LG + LL + LLG + 3P</span>
        </div>

        <div className="bg-[#070c18] border border-slate-800 rounded p-2">
          <span className="text-[10px] text-slate-400 uppercase font-bold">Active Certainty</span>
          <div className="text-sm font-bold text-amber-400 mt-0.5">{confidence}%</div>
          <span className="text-[10px] text-slate-500">Inference: &lt; 3.5ms</span>
        </div>
      </div>

      {/* Feature Importance Bars */}
      <div className="bg-[#070b12] border border-slate-800 rounded p-2.5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800 pb-1">
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3 text-sky-400" />
            Top Spectral &amp; Sequence Features (Gini Importance)
          </span>
          <span>Weight</span>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          {topFeats.slice(0, 6).map((item, idx) => {
            const pct = Math.round(item.importance * 1000) / 10;
            const barWidth = Math.min(100, (item.importance / 0.1) * 100);
            return (
              <div key={idx} className="flex items-center gap-2 text-[11px]">
                <span className="w-24 text-slate-300 font-mono text-[10px] truncate">
                  {item.feature}
                </span>
                <div className="flex-1 bg-slate-800 h-2 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[10px] text-slate-400">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

