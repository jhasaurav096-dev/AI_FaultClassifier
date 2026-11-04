import React from 'react';
import Oscilloscope from '../components/Oscilloscope';
import SingleLineDiagram from '../components/SingleLineDiagram';
import RelayStatusPanel from '../components/RelayStatusPanel';
import FaultControlPanel from '../components/FaultControlPanel';
import { useTelemetry } from '../context/TelemetryContext';

export default function ControlCenterPage() {
  const {
    telemetryBuffer,
    isPaused,
    setIsPaused,
    classification,
    tripStatus,
    renewableTelemetry,
    handleInjectFault,
    handleClearFault,
    handleResetRelay,
    handleUpdateRenewable,
    handleTriggerInverterTransient
  } = useTelemetry();

  return (
    <div className="flex-1 flex flex-col gap-3">
      {/* Primary Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left Section (8 Columns): High-Speed Oscilloscope & 400kV Single Line Diagram */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <Oscilloscope
            telemetryBuffer={telemetryBuffer}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
          />

          <SingleLineDiagram
            breakerState={tripStatus.breaker_state}
            relayTripped={tripStatus.relay_tripped}
            classification={classification}
            distanceKm={classification?.estimated_distance_km}
          />
        </div>

        {/* Right Section (4 Columns): Digital Protection Relay & Operator Console */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <RelayStatusPanel
            classification={classification}
            tripStatus={tripStatus}
            onResetRelay={handleResetRelay}
          />

          <FaultControlPanel
            onInjectFault={handleInjectFault}
            onClearFault={handleClearFault}
            onResetRelay={handleResetRelay}
            activeFaultInjected={classification?.class_id > 0}
            relayTripped={tripStatus.relay_tripped}
            renewableTelemetry={renewableTelemetry}
            onUpdateRenewable={handleUpdateRenewable}
            onTriggerInverterTransient={handleTriggerInverterTransient}
          />
        </div>
      </div>
    </div>
  );
}

