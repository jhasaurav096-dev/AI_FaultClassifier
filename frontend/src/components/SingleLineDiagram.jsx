import React from 'react';
import { Zap, ShieldAlert, Cpu } from 'lucide-react';

export default function SingleLineDiagram({
  breakerState,
  relayTripped,
  classification,
  distanceKm
}) {
  const isTripped = breakerState === 'TRIPPED' || breakerState === 'OPEN';
  const faultDist = distanceKm || 45.0;
  const faultPercent = Math.min(92, Math.max(8, faultDist));

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono">
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">SINGLE LINE DIAGRAM (SLD) - FEEDER TL-4001</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>RATING: 400 kV / 1200 MVA</span>
          <span>&bull;</span>
          <span>LENGTH: 100 km</span>
        </div>
      </div>

      {/* SVG SCADA Mimic Diagram */}
      <div className="relative bg-[#070b12] border border-slate-800/80 rounded p-4 flex items-center justify-center">
        <svg
          viewBox="0 0 900 130"
          className="w-full h-auto max-h-[130px] overflow-visible"
        >
          {/* Substation A Busbar (Vertical thick line) */}
          <line x1="60" y1="20" x2="60" y2="110" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
          <text x="60" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="JetBrains Mono">
            BUS-A (400kV)
          </text>

          {/* Feeder lead from Bus A to Breaker */}
          <line x1="60" y1="65" x2="130" y2="65" stroke={isTripped ? '#94a3b8' : '#eab308'} strokeWidth="3" />

          {/* Breaker CB-101 graphic */}
          <rect
            x="130"
            y="45"
            width="40"
            height="40"
            rx="4"
            fill={isTripped ? '#450a0a' : '#064e3b'}
            stroke={isTripped ? '#ef4444' : '#10b981'}
            strokeWidth="2.5"
            className={isTripped ? 'animate-pulse' : ''}
          />
          {/* Breaker contacts inside */}
          {isTripped ? (
            // Open contact (slash)
            <line x1="140" y1="75" x2="160" y2="55" stroke="#ef4444" strokeWidth="3" />
          ) : (
            // Closed contact (solid horizontal bar)
            <line x1="135" y1="65" x2="165" y2="65" stroke="#10b981" strokeWidth="4" />
          )}
          <text x="150" y="100" fill={isTripped ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="bold" textAnchor="middle">
            CB-101 [{isTripped ? 'TRIPPED' : 'CLOSED'}]
          </text>

          {/* CT / VT Instrument Transformer Relays */}
          <line x1="170" y1="65" x2="230" y2="65" stroke={isTripped ? '#94a3b8' : '#eab308'} strokeWidth="3" />
          <circle cx="200" cy="65" r="12" fill="#0f172a" stroke="#0ea5e9" strokeWidth="2" />
          <text x="200" y="69" fill="#0ea5e9" fontSize="9" fontWeight="bold" textAnchor="middle">
            CT/VT
          </text>

          {/* Transmission Line Span (100 km) */}
          <line
            x1="230"
            y1="65"
            x2="710"
            y2="65"
            stroke={isTripped ? '#ef4444' : '#eab308'}
            strokeWidth="3.5"
            strokeDasharray={isTripped ? '8 4' : 'none'}
          />

          {/* Transmission Line Towers Mimic */}
          <path d="M350 45 L350 85 M340 55 L360 55 M335 70 L365 70" stroke="#475569" strokeWidth="1.5" />
          <path d="M500 45 L500 85 M490 55 L510 55 M485 70 L515 70" stroke="#475569" strokeWidth="1.5" />
          <path d="M620 45 L620 85 M610 55 L630 55 M605 70 L635 70" stroke="#475569" strokeWidth="1.5" />

          {/* Overhead Line Text */}
          <text x="470" y="35" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">
            TRANSMISSION LINE TL-4001 (100 KM)
          </text>

          {/* Fault Indicator Marker (if tripped or fault) */}
          {relayTripped && (
            <g transform={`translate(${230 + (480 * (faultPercent / 100))}, 65)`}>
              <circle cx="0" cy="0" r="16" fill="rgba(239, 68, 68, 0.3)" className="animate-ping" />
              <polygon points="0,-16 14,12 -14,12" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
              <text x="0" y="5" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">
                !
              </text>
              <text x="0" y="28" fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle">
                FAULT @ {faultDist} km
              </text>
            </g>
          )}

          {/* Breaker CB-102 at Substation Beta */}
          <line x1="710" y1="65" x2="750" y2="65" stroke={isTripped ? '#94a3b8' : '#eab308'} strokeWidth="3" />
          <rect
            x="750"
            y="45"
            width="40"
            height="40"
            rx="4"
            fill={isTripped ? '#450a0a' : '#064e3b'}
            stroke={isTripped ? '#ef4444' : '#10b981'}
            strokeWidth="2.5"
          />
          {isTripped ? (
            <line x1="760" y1="75" x2="780" y2="55" stroke="#ef4444" strokeWidth="3" />
          ) : (
            <line x1="755" y1="65" x2="785" y2="65" stroke="#10b981" strokeWidth="4" />
          )}
          <text x="770" y="100" fill={isTripped ? '#ef4444' : '#10b981'} fontSize="9" fontWeight="bold" textAnchor="middle">
            CB-102
          </text>

          {/* Feeder lead to Bus B */}
          <line x1="790" y1="65" x2="840" y2="65" stroke={isTripped ? '#94a3b8' : '#eab308'} strokeWidth="3" />

          {/* Substation B Busbar */}
          <line x1="840" y1="20" x2="840" y2="110" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
          <text x="840" y="15" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
            BUS-B (400kV)
          </text>
        </svg>
      </div>
    </div>
  );
}

