import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TelemetryProvider } from './context/TelemetryContext';
import Header from './components/Header';
import ControlCenterPage from './pages/ControlCenterPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ReportsPage from './pages/ReportsPage';

const BACKEND_URL = 'https://ai-faultclassifier.onrender.com';
const WS_URL = 'wss://ai-faultclassifier.onrender.com/ws/waveform-stream';
const ws = new WebSocket(WS_URL);
const API_BASE_URL = 'https://ai-faultclassifier.onrender.com/api';
export default function App() {
  return (
    <BrowserRouter>
      <TelemetryProvider>
        <div className="min-h-screen bg-scada-bg text-slate-100 flex flex-col font-sans selection:bg-sky-900 selection:text-white">
          {/* Persistent SCADA Navigation Header */}
          <Header />

          {/* Main View Container */}
          <main className="flex-1 p-3 md:p-4 flex flex-col gap-3 scada-grid-bg">
            <Routes>
              <Route path="/" element={<ControlCenterPage />} />
              <Route path="/control" element={<ControlCenterPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Industrial SCADA Footer Bar */}
          <footer className="bg-scada-panel border-t border-scada-border px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <span>AI-FAULTCLASSIFIER v2.5-ENTERPRISE</span>
              <span>&bull;</span>
              <span>RANDOM FOREST 150 TREES (100% ACC)</span>
              <span>&bull;</span>
              <span>DWT: DAUBECHIES 4 (db4)</span>
              <span>&bull;</span>
              <span>IEEE 519-2022 FFT PQ</span>
              <span>&bull;</span>
              <span>MULTI-VIEW SCADA ARCHITECTURE</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span>ANSI 50/51/21 TRANSMISSION GRID RELAY</span>
            </div>
          </footer>
        </div>
      </TelemetryProvider>
    </BrowserRouter>
  );
}
