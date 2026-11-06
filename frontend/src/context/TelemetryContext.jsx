import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const TelemetryContext = createContext(null);


const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://ai-faultclassifier.onrender.com';

const WS_URL =
  API_BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') +
  '/ws/waveform-stream';

export function TelemetryProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [telemetryBuffer, setTelemetryBuffer] = useState([]);
  const [latestSample, setLatestSample] = useState(null);
  const [classification, setClassification] = useState(null);
  const [waveletSpectrum, setWaveletSpectrum] = useState(null);
  const [powerQuality, setPowerQuality] = useState(null);
  const [renewableTelemetry, setRenewableTelemetry] = useState(null);
  const [tripStatus, setTripStatus] = useState({
    relay_tripped: false,
    breaker_state: 'CLOSED',
    trip_latency_ms: 0,
    trip_timestamp: null,
    trip_details: null
  });
  const [gridTelemetry, setGridTelemetry] = useState(null);
  const [events, setEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const lastTripStateRef = useRef(false);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[SCADA-WS] Connected to transmission telemetry stream.');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'TELEMETRY_FRAME') {
            const points = payload.points || [];

            if (!isPaused) {
              setTelemetryBuffer((prev) => {
                const combined = [...prev, ...points];
                return combined.slice(-320); // Keep last 320 samples (160ms)
              });
            }

            if (points.length > 0) {
              setLatestSample(points[points.length - 1]);
            }

            setClassification(payload.classification);
            setWaveletSpectrum(payload.wavelet_spectrum);
            if (payload.power_quality) {
              setPowerQuality(payload.power_quality);
            }
            if (payload.renewable_telemetry) {
              setRenewableTelemetry(payload.renewable_telemetry);
            }
            setTripStatus(payload.trip_status);
            setGridTelemetry(payload.grid_telemetry);

            // Check if relay transitioned to tripped state to log event
            const isTripped = payload.trip_status?.relay_tripped;
            if (isTripped && !lastTripStateRef.current) {
              lastTripStateRef.current = true;
              const details = payload.trip_status.trip_details || payload.classification;
              const newEvt = {
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
                severity: 'TRIP',
                ansi: details?.ansi_code || 'ANSI 50/21',
                message: `PROTECTIVE TRIP: ${details?.name || 'Transmission Line Fault'}`,
                distance: details?.distance_km || details?.estimated_distance_km,
                latency: payload.trip_status.trip_latency_ms,
                category: details?.category || 'Fault Event'
              };
              setEvents((prev) => [newEvt, ...prev].slice(0, 200));
            } else if (!isTripped && lastTripStateRef.current) {
              lastTripStateRef.current = false;
              const newEvt = {
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
                severity: 'NORMAL',
                ansi: 'NORMAL',
                message: 'BREAKER RECLOSED - RELAY SYSTEM RESTORED TO HEALTHY STATE',
                distance: null,
                latency: null,
                category: 'System Normal'
              };
              setEvents((prev) => [newEvt, ...prev].slice(0, 200));
            }
          }
        } catch (err) {
          console.error('[SCADA-WS] Error parsing frame:', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.warn('[SCADA-WS] WebSocket closed. Retrying in 2s...');
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };

      ws.onerror = (err) => {
        console.error('[SCADA-WS] WebSocket error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('[SCADA-WS] Connection failed:', e);
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
    }
  }, [isPaused]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connectWebSocket]);

  // Actions
  const handleInjectFault = (params) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'INJECT_FAULT',
          ...params
        })
      );
    } else {
      fetch(`${API_BASE}/api/inject-fault`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }).catch(console.error);
    }

    setEvents((prev) => [
      {
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
        severity: 'WARNING',
        ansi: 'OP-INJECT',
        message: `Operator fault injection drill: Class ${params.fault_class} @ ${params.distance_km} km`,
        distance: params.distance_km,
        latency: null,
        category: 'Operator Drill'
      },
      ...prev
    ].slice(0, 200));
  };

  const handleClearFault = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'CLEAR_FAULT' }));
    }
  };

  const handleResetRelay = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'RESET_RELAY' }));
    } else {
      fetch(`${API_BASE}/api/reset-relay`, { method: 'POST' }).catch(console.error);
    }
  };

  const handleUpdateRenewable = (config) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'UPDATE_RENEWABLE',
          ...config
        })
      );
    }
    fetch(`${API_BASE}/api/renewable-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    }).catch(console.error);
  };

  const handleTriggerInverterTransient = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'TRIGGER_INVERTER_TRANSIENT',
          duration_ms: 400.0
        })
      );
    }
    fetch(`${API_BASE}/api/inverter-transient?duration_ms=400.0`, {
      method: 'POST'
    }).catch(console.error);
  };

  const handleClearEvents = () => {
    setEvents([]);
  };

  const value = {
    connected,
    telemetryBuffer,
    latestSample,
    classification,
    waveletSpectrum,
    powerQuality,
    renewableTelemetry,
    tripStatus,
    gridTelemetry,
    events,
    isPaused,
    setIsPaused,
    handleInjectFault,
    handleClearFault,
    handleResetRelay,
    handleUpdateRenewable,
    handleTriggerInverterTransient,
    handleClearEvents,
    apiBase: API_BASE
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}

