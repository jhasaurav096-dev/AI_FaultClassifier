import React from 'react';
import WaveletEnergyBars from '../components/WaveletEnergyBars';
import PhasorDiagram from '../components/PhasorDiagram';
import PowerQualityCard from '../components/PowerQualityCard';
import AiDiagnosticsCard from '../components/AiDiagnosticsCard';
import LiveGridTelemetry from '../components/LiveGridTelemetry';
import { useTelemetry } from '../context/TelemetryContext';

export default function AnalyticsPage() {
  const {
    waveletSpectrum,
    latestSample,
    classification,
    powerQuality,
    gridTelemetry
  } = useTelemetry();

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Top Grid: DWT Wavelet Sub-band Decomposition & Complex Phasor Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <div className="lg:col-span-7 flex flex-col gap-3">
          <WaveletEnergyBars waveletSpectrum={waveletSpectrum} />
          <PowerQualityCard powerQuality={powerQuality} />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-3">
          <PhasorDiagram
            latestSample={latestSample}
            classification={classification}
          />
          <AiDiagnosticsCard />
          <LiveGridTelemetry gridTelemetry={gridTelemetry} />
        </div>
      </div>
    </div>
  );
}

