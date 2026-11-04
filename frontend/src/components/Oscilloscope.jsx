import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RefreshCw, ZoomIn, Eye, Activity } from 'lucide-react';
import { PHASE_COLORS, formatPerUnit } from '../utils/scadaTheme';

export default function Oscilloscope({ telemetryBuffer, isPaused, setIsPaused }) {
  const vCanvasRef = useRef(null);
  const iCanvasRef = useRef(null);

  // Channel toggles
  const [visibleChannels, setVisibleChannels] = useState({
    Va: true,
    Vb: true,
    Vc: true,
    Ia: true,
    Ib: true,
    Ic: true,
    I0: false
  });

  const [timebaseSamples, setTimebaseSamples] = useState(160); // 80ms at 2kHz
  const [vScale, setVScale] = useState(1.0);
  const [iScale, setIScale] = useState(1.0);

  const toggleChannel = (ch) => {
    setVisibleChannels((prev) => ({ ...prev, [ch]: !prev[ch] }));
  };

  // Render high-performance 60fps canvas oscilloscope
  useEffect(() => {
    const vCanvas = vCanvasRef.current;
    const iCanvas = iCanvasRef.current;
    if (!vCanvas || !iCanvas || !telemetryBuffer || telemetryBuffer.length === 0) return;

    const vCtx = vCanvas.getContext('2d');
    const iCtx = iCanvas.getContext('2d');

    const width = vCanvas.width;
    const height = vCanvas.height;

    // Slice latest samples according to timebase
    const dataSlice = telemetryBuffer.slice(-timebaseSamples);
    const n = dataSlice.length;

    // Helper to draw grid and graticules
    const drawGrid = (ctx, yLabel, yMaxStr, yMinStr) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;

      // Vertical divisions (8 divs)
      const numVDivs = 8;
      for (let i = 1; i < numVDivs; i++) {
        const x = (width / numVDivs) * i;
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal divisions (6 divs)
      const numHDivs = 6;
      for (let i = 1; i < numHDivs; i++) {
        const y = (height / numHDivs) * i;
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline (solid zero line)
      ctx.setLineDash([]);
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Labels
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(yMaxStr, 8, 14);
      ctx.fillText('0.00', 8, height / 2 - 4);
      ctx.fillText(yMinStr, 8, height - 6);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(yLabel, width - 110, 14);
    };

    // Draw Voltage Canvas
    drawGrid(vCtx, 'VOLTAGE (p.u. / kV)', `+${(1.5 / vScale).toFixed(1)} p.u.`, `-${(1.5 / vScale).toFixed(1)} p.u.`);
    const vMaxAbs = 1.6 / vScale;

    const channelsV = ['Va', 'Vb', 'Vc'];
    channelsV.forEach((ch) => {
      if (!visibleChannels[ch] || n < 2) return;

      vCtx.strokeStyle = PHASE_COLORS[ch];
      vCtx.lineWidth = 1.8;
      vCtx.beginPath();

      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * width;
        const val = dataSlice[i][ch] || 0;
        // Map val (-vMaxAbs to +vMaxAbs) to (height to 0)
        const y = height / 2 - (val / vMaxAbs) * (height / 2);
        if (i === 0) vCtx.moveTo(x, y);
        else vCtx.lineTo(x, y);
      }
      vCtx.stroke();
    });

    // Draw Current Canvas
    drawGrid(iCtx, 'CURRENT (p.u. / kA)', `+${(8.0 / iScale).toFixed(1)} p.u.`, `-${(8.0 / iScale).toFixed(1)} p.u.`);
    const iMaxAbs = 8.0 / iScale;

    const channelsI = ['Ia', 'Ib', 'Ic'];
    channelsI.forEach((ch) => {
      if (!visibleChannels[ch] || n < 2) return;

      iCtx.strokeStyle = PHASE_COLORS[ch];
      iCtx.lineWidth = 1.8;
      iCtx.beginPath();

      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * width;
        const val = dataSlice[i][ch] || 0;
        const y = height / 2 - (val / iMaxAbs) * (height / 2);
        if (i === 0) iCtx.moveTo(x, y);
        else iCtx.lineTo(x, y);
      }
      iCtx.stroke();
    });

    // Draw Residual Neutral Current (I0 = Ia + Ib + Ic) if toggled
    if (visibleChannels.I0 && n >= 2) {
      iCtx.strokeStyle = PHASE_COLORS.I0;
      iCtx.lineWidth = 2.0;
      iCtx.setLineDash([4, 2]);
      iCtx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * width;
        const val = (dataSlice[i].Ia || 0) + (dataSlice[i].Ib || 0) + (dataSlice[i].Ic || 0);
        const y = height / 2 - (val / iMaxAbs) * (height / 2);
        if (i === 0) iCtx.moveTo(x, y);
        else iCtx.lineTo(x, y);
      }
      iCtx.stroke();
      iCtx.setLineDash([]);
    }
  }, [telemetryBuffer, visibleChannels, timebaseSamples, vScale, iScale]);

  // Latest sample telemetry for numerical meters
  const latest = telemetryBuffer && telemetryBuffer.length > 0 ? telemetryBuffer[telemetryBuffer.length - 1] : {};

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel flex flex-col">
      {/* Oscilloscope Header Controls */}
      <div className="bg-slate-900/90 border-b border-scada-border px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">REAL-TIME TRANSIENT OSCILLOSCOPE</span>
          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
            fs: 2.0 kHz (40 samples/cycle)
          </span>
        </div>

        {/* Oscilloscope Hardware Knobs */}
        <div className="flex items-center gap-3">
          {/* Timebase */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">TIMEBASE:</span>
            <select
              value={timebaseSamples}
              onChange={(e) => setTimebaseSamples(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-sky-300 rounded px-2 py-0.5 text-xs font-mono"
            >
              <option value={80}>40 ms (2 cycles)</option>
              <option value={160}>80 ms (4 cycles)</option>
              <option value={240}>120 ms (6 cycles)</option>
            </select>
          </div>

          {/* Scale */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">SCALE:</span>
            <button
              onClick={() => {
                setVScale((s) => (s >= 2.0 ? 0.5 : s + 0.5));
                setIScale((s) => (s >= 2.0 ? 0.5 : s + 0.5));
              }}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded"
            >
              {vScale.toFixed(1)}x
            </button>
          </div>

          {/* Run / Freeze */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded font-bold border transition-colors ${
              isPaused
                ? 'bg-amber-600/30 border-amber-500 text-amber-300 hover:bg-amber-600/50'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
            <span>{isPaused ? 'RESUME RUN' : 'FREEZE'}</span>
          </button>
        </div>
      </div>

      {/* Dual Screen Display */}
      <div className="p-3 grid grid-cols-1 gap-2.5 bg-[#070b12]">
        {/* Voltage Viewport */}
        <div className="relative border border-slate-800 rounded bg-[#090d16] overflow-hidden">
          <div className="absolute top-1.5 right-2 flex items-center gap-2 z-10 font-mono text-[11px]">
            <span className="text-slate-400">3-PHASE VOLTAGE BUS:</span>
            <span className="text-yellow-400">Va: {formatPerUnit(latest.Va)} pu</span>
            <span className="text-cyan-400">Vb: {formatPerUnit(latest.Vb)} pu</span>
            <span className="text-red-400">Vc: {formatPerUnit(latest.Vc)} pu</span>
          </div>
          <canvas
            ref={vCanvasRef}
            width={800}
            height={160}
            className="w-full h-[150px] md:h-[160px] block"
          />
        </div>

        {/* Current Viewport */}
        <div className="relative border border-slate-800 rounded bg-[#090d16] overflow-hidden">
          <div className="absolute top-1.5 right-2 flex items-center gap-2 z-10 font-mono text-[11px]">
            <span className="text-slate-400">3-PHASE CURRENT FEEDER:</span>
            <span className="text-amber-400">Ia: {formatPerUnit(latest.Ia)} pu</span>
            <span className="text-sky-400">Ib: {formatPerUnit(latest.Ib)} pu</span>
            <span className="text-rose-400">Ic: {formatPerUnit(latest.Ic)} pu</span>
            {visibleChannels.I0 && (
              <span className="text-purple-400 font-bold">
                I0: {formatPerUnit((latest.Ia || 0) + (latest.Ib || 0) + (latest.Ic || 0))} pu
              </span>
            )}
          </div>
          <canvas
            ref={iCanvasRef}
            width={800}
            height={160}
            className="w-full h-[150px] md:h-[160px] block"
          />
        </div>
      </div>

      {/* Channel Selector & Telemetry Footer */}
      <div className="bg-slate-900/90 border-t border-scada-border px-3 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Toggle Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-[11px]">CHANNELS:</span>

          {/* Va */}
          <button
            onClick={() => toggleChannel('Va')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Va
                ? 'bg-yellow-950/60 border-yellow-500 text-yellow-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Va (Yellow)
          </button>

          {/* Vb */}
          <button
            onClick={() => toggleChannel('Vb')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Vb
                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Vb (Cyan)
          </button>

          {/* Vc */}
          <button
            onClick={() => toggleChannel('Vc')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Vc
                ? 'bg-red-950/60 border-red-500 text-red-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Vc (Red)
          </button>

          <span className="text-slate-600">|</span>

          {/* Ia */}
          <button
            onClick={() => toggleChannel('Ia')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Ia
                ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Ia
          </button>

          {/* Ib */}
          <button
            onClick={() => toggleChannel('Ib')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Ib
                ? 'bg-sky-950/60 border-sky-500 text-sky-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Ib
          </button>

          {/* Ic */}
          <button
            onClick={() => toggleChannel('Ic')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.Ic
                ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            Ic
          </button>

          {/* I0 Residual */}
          <button
            onClick={() => toggleChannel('I0')}
            className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
              visibleChannels.I0
                ? 'bg-purple-950/60 border-purple-500 text-purple-300'
                : 'bg-slate-800/40 border-slate-700 text-slate-500'
            }`}
          >
            I0 (Residual Ground)
          </button>
        </div>

        {/* Live instantaneous metrics readout */}
        <div className="flex items-center gap-3 text-[11px] text-slate-300">
          <div>
            <span className="text-slate-500">BASE: </span>
            <span className="text-sky-300 font-semibold">400 kV</span> / <span className="text-sky-300 font-semibold">1.25 kA</span>
          </div>
          <div>
            <span className="text-slate-500">PEAK Ia: </span>
            <span className="text-amber-400 font-semibold">{latest.Ia_kA || '0.00'} kA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

