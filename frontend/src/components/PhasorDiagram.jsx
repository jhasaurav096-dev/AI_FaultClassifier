import React, { useRef, useEffect } from 'react';
import { Compass } from 'lucide-react';
import { PHASE_COLORS } from '../utils/scadaTheme';

export default function PhasorDiagram({ latestSample, classification }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 22;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Polar circles
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach((rFactor) => {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * rFactor, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Cross axes
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Polar degree markers (0, 120, 240 deg)
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('0° (Phase A)', cx + radius - 30, cy - 4);
    ctx.fillText('240° (Phase C)', cx - radius * 0.5 - 20, cy - radius * 0.866 + 8);
    ctx.fillText('120° (Phase B)', cx - radius * 0.5 - 20, cy + radius * 0.866 - 4);

    // Compute approximate magnitudes from latest sample
    const va = latestSample?.Va ?? 1.0;
    const vb = latestSample?.Vb ?? -0.5;
    const vc = latestSample?.Vc ?? -0.5;
    const ia = latestSample?.Ia ?? 1.0;
    const ib = latestSample?.Ib ?? -0.5;
    const ic = latestSample?.Ic ?? -0.5;

    // Helper to draw phasor arrow
    const drawPhasor = (angleRad, magnitude, color, label, isCurrent = false) => {
      // Scale length
      const length = Math.min(radius, Math.max(12, magnitude * (radius * 0.75)));
      const x = cx + length * Math.cos(angleRad);
      const y = cy - length * Math.sin(angleRad); // canvas y is inverted

      ctx.strokeStyle = color;
      ctx.lineWidth = isCurrent ? 2.5 : 2.0;
      if (isCurrent) ctx.setLineDash([3, 2]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const headLen = 6;
      const arrowAngle = Math.atan2(cy - y, x - cx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - headLen * Math.cos(arrowAngle - Math.PI / 6),
        y + headLen * Math.sin(arrowAngle - Math.PI / 6)
      );
      ctx.lineTo(
        x - headLen * Math.cos(arrowAngle + Math.PI / 6),
        y + headLen * Math.sin(arrowAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Label
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, x + (x > cx ? 6 : -18), y + (y > cy ? 12 : -4));
    };

    // Calculate approximate phase angles based on power system sequence
    // Nominal: Va at 0, Vb at -120 deg (-2pi/3), Vc at +120 deg (2pi/3)
    // When faulted, magnitudes vary based on instantaneous sample envelope
    const magVa = Math.abs(va) > 0.05 ? Math.abs(va) : 0.15;
    const magVb = Math.abs(vb) > 0.05 ? Math.abs(vb) : 0.15;
    const magVc = Math.abs(vc) > 0.05 ? Math.abs(vc) : 0.15;

    const magIa = Math.min(1.4, Math.max(0.2, Math.abs(ia) * 0.3));
    const magIb = Math.min(1.4, Math.max(0.2, Math.abs(ib) * 0.3));
    const magIc = Math.min(1.4, Math.max(0.2, Math.abs(ic) * 0.3));

    // Draw Voltage Phasors
    drawPhasor(0, magVa, PHASE_COLORS.Va, 'Va');
    drawPhasor(-2 * Math.PI / 3, magVb, PHASE_COLORS.Vb, 'Vb');
    drawPhasor(2 * Math.PI / 3, magVc, PHASE_COLORS.Vc, 'Vc');

    // Draw Current Phasors (lagging ~25 degrees from voltage)
    const pfLag = -0.4;
    drawPhasor(pfLag, magIa, PHASE_COLORS.Ia, 'Ia', true);
    drawPhasor(-2 * Math.PI / 3 + pfLag, magIb, PHASE_COLORS.Ib, 'Ib', true);
    drawPhasor(2 * Math.PI / 3 + pfLag, magIc, PHASE_COLORS.Ic, 'Ic', true);
  }, [latestSample]);

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">POLAR PHASOR VECTOR DISPLAY</span>
        </div>
        <span className="text-[10px] text-slate-400">Solid: V | Dashed: I</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-2 bg-[#070b12] rounded border border-slate-800">
        <canvas
          ref={canvasRef}
          width={240}
          height={240}
          className="w-[200px] h-[200px] block"
        />
      </div>

      <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between px-1">
        <span>Balanced 120° Displacement</span>
        <span className="text-sky-300">PF: 0.92 Lagging</span>
      </div>
    </div>
  );
}

