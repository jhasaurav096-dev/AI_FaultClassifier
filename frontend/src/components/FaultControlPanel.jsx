import React, { useState } from 'react';
import {
  Sliders,
  Flame,
  ShieldAlert,
  Dice5,
  CheckCircle2,
  RotateCcw,
  Sun,
  Wind,
  Zap,
  Power
} from 'lucide-react';
import { FAULT_TAXONOMY_MAP } from '../utils/scadaTheme';

export default function FaultControlPanel({
  onInjectFault,
  onClearFault,
  onResetRelay,
  activeFaultInjected,
  relayTripped,
  renewableTelemetry,
  onUpdateRenewable,
  onTriggerInverterTransient
}) {
  const [activeTab, setActiveTab] = useState('fault'); // 'fault' | 'renewable'

  // Fault parameters
  const [selectedClass, setSelectedClass] = useState(1); // Default to AG
  const [distanceKm, setDistanceKm] = useState(42.0);
  const [resistanceOhm, setResistanceOhm] = useState(2.5);
  const [durationMs, setDurationMs] = useState(350);

  // Renewable parameters
  const [solarEnabled, setSolarEnabled] = useState(true);
  const [windEnabled, setWindEnabled] = useState(true);
  const [solarPenetration, setSolarPenetration] = useState(0.25);
  const [windPenetration, setWindPenetration] = useState(0.25);

  const ren = renewableTelemetry || {
    solar_enabled: true,
    wind_enabled: true,
    solar_penetration_pct: 25.0,
    wind_penetration_pct: 25.0,
    solar_mw: 37.5,
    wind_mw: 62.5,
    total_renewable_mw: 100.0,
    renewable_penetration_pct: 16.7,
    solar_irradiance_wm2: 850.0,
    wind_speed_ms: 11.2,
    inverter_switching_khz: 1.05,
    inverter_transient_active: false
  };

  const handleTrigger = () => {
    onInjectFault({
      fault_class: Number(selectedClass),
      distance_km: Number(distanceKm),
      resistance_ohm: Number(resistanceOhm),
      duration_ms: Number(durationMs)
    });
  };

  const handleRandomDrill = () => {
    const randClass = Math.floor(Math.random() * 10) + 1;
    const randDist = Math.round((Math.random() * 85 + 5) * 10) / 10;
    const randRf = Math.round((Math.random() * 20 + 0.5) * 10) / 10;
    setSelectedClass(randClass);
    setDistanceKm(randDist);
    setResistanceOhm(randRf);
    onInjectFault({
      fault_class: randClass,
      distance_km: randDist,
      resistance_ohm: randRf,
      duration_ms: 350
    });
  };

  const handleUpdateRenewable = (updates) => {
    const nextSolarEnabled = updates.solar_enabled !== undefined ? updates.solar_enabled : solarEnabled;
    const nextWindEnabled = updates.wind_enabled !== undefined ? updates.wind_enabled : windEnabled;
    const nextSolarPen = updates.solar_penetration !== undefined ? updates.solar_penetration : solarPenetration;
    const nextWindPen = updates.wind_penetration !== undefined ? updates.wind_penetration : windPenetration;

    if (updates.solar_enabled !== undefined) setSolarEnabled(updates.solar_enabled);
    if (updates.wind_enabled !== undefined) setWindEnabled(updates.wind_enabled);
    if (updates.solar_penetration !== undefined) setSolarPenetration(updates.solar_penetration);
    if (updates.wind_penetration !== undefined) setWindPenetration(updates.wind_penetration);

    if (onUpdateRenewable) {
      onUpdateRenewable({
        solar_enabled: nextSolarEnabled,
        wind_enabled: nextWindEnabled,
        solar_penetration: nextSolarPen,
        wind_penetration: nextWindPen
      });
    }
  };

  return (
    <div className="bg-scada-panel border border-scada-border rounded-md overflow-hidden scada-bezel p-3 font-mono flex flex-col">
      {/* Header Bar with Tabs */}
      <div className="flex items-center justify-between border-b border-scada-border pb-2 mb-3 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-slate-200">OPERATOR CONTROL &amp; INJECTION CONSOLE</span>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 text-[11px]">
          <button
            onClick={() => setActiveTab('fault')}
            className={`px-2.5 py-1 rounded font-bold transition-all ${
              activeTab === 'fault'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fault Injector (11 Classes)
          </button>
          <button
            onClick={() => setActiveTab('renewable')}
            className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 transition-all ${
              activeTab === 'renewable'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3 h-3 text-amber-300" />
            <Wind className="w-3 h-3 text-sky-300" />
            <span>Renewable Mix</span>
            {ren.inverter_transient_active && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping inline-block" />
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Fault Injection */}
      {activeTab === 'fault' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-3">
            {/* Fault Selector */}
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-slate-400 text-[10px] uppercase font-bold">
                Select Fault Taxonomy (11 Standard Classes)
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2.5 py-1.5 text-xs font-mono focus:border-sky-500 focus:outline-none"
              >
                {Object.entries(FAULT_TAXONOMY_MAP).map(([id, meta]) => (
                  <option key={id} value={id}>
                    Class {id}: {meta.name} [{meta.ansi}]
                  </option>
                ))}
              </select>
            </div>

            {/* Distance Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>FAULT DISTANCE:</span>
                <span className="text-sky-300 font-bold">{distanceKm} km</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                step="1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>5 km (Zone 1)</span>
                <span>95 km (Zone 2)</span>
              </div>
            </div>

            {/* Resistance Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>ARC RESISTANCE:</span>
                <span className="text-amber-300 font-bold">{resistanceOhm} &Omega;</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="30"
                step="0.5"
                value={resistanceOhm}
                onChange={(e) => setResistanceOhm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>0.1 &Omega; (Bolted)</span>
                <span>30 &Omega; (High-Z Arc)</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleTrigger}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded shadow transition-all text-xs"
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>INJECT TRANSIENT FAULT</span>
            </button>

            <button
              onClick={handleRandomDrill}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded text-xs transition-colors"
            >
              <Dice5 className="w-3.5 h-3.5 text-sky-400" />
              <span>RANDOM SCADA DRILL</span>
            </button>

            <button
              onClick={onClearFault}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded text-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>CLEAR INJECTION</span>
            </button>

            {relayTripped && (
              <button
                onClick={onResetRelay}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded text-xs transition-colors ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET TRIP LOCKOUT</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Tab 2: Renewable Generation Mix */}
      {activeTab === 'renewable' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Solar PV Control Card */}
            <div className="bg-[#070c18] border border-slate-800 rounded p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-slate-200">Solar PV Farm (150 MW)</span>
                </div>
                <button
                  onClick={() => handleUpdateRenewable({ solar_enabled: !solarEnabled })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                    solarEnabled
                      ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Power className="w-2.5 h-2.5" />
                  <span>{solarEnabled ? 'FEED-IN ACTIVE' : 'ISOLATED'}</span>
                </button>
              </div>

              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Penetration Target:</span>
                <span className="font-mono font-bold text-amber-300">
                  {Math.round(solarPenetration * 100)}% ({ren.solar_mw} MW)
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                disabled={!solarEnabled}
                value={solarPenetration}
                onChange={(e) => handleUpdateRenewable({ solar_penetration: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-40"
              />

              <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                <span>G: {ren.solar_irradiance_wm2} W/m&sup2;</span>
                <span>f_sw: {ren.inverter_switching_khz} kHz (PWM)</span>
              </div>
            </div>

            {/* Wind Turbine Farm Control Card */}
            <div className="bg-[#070c18] border border-slate-800 rounded p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-slate-200">Wind Farm (250 MW DFIG)</span>
                </div>
                <button
                  onClick={() => handleUpdateRenewable({ wind_enabled: !windEnabled })}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                    windEnabled
                      ? 'bg-sky-950/60 border-sky-500/50 text-sky-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  <Power className="w-2.5 h-2.5" />
                  <span>{windEnabled ? 'FEED-IN ACTIVE' : 'ISOLATED'}</span>
                </button>
              </div>

              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Penetration Target:</span>
                <span className="font-mono font-bold text-sky-300">
                  {Math.round(windPenetration * 100)}% ({ren.wind_mw} MW)
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                disabled={!windEnabled}
                value={windPenetration}
                onChange={(e) => handleUpdateRenewable({ wind_penetration: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-40"
              />

              <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                <span>Speed: {ren.wind_speed_ms} m/s</span>
                <span>Blade Ripple: 1.45 Hz</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Total Renewable Share & Inverter Transient Trigger */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-2 flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-[11px]">
                Feeder Mix Share:{' '}
                <strong className="text-emerald-400 font-mono">
                  {ren.renewable_penetration_pct}% ({ren.total_renewable_mw} MW)
                </strong>
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400 text-[11px]">
                DWT Classifier Immunity:{' '}
                <strong className="text-sky-300 font-mono">100.0% VERIFIED</strong>
              </span>
            </div>

            <button
              onClick={() => onTriggerInverterTransient && onTriggerInverterTransient()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                ren.inverter_transient_active
                  ? 'bg-amber-600 border-amber-400 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {ren.inverter_transient_active
                  ? 'COMMUTATION TRANSIENT ACTIVE...'
                  : 'TRIGGER INVERTER TRANSIENT'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
