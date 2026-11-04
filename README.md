# AI-FaultClassifier: AI-Based Transmission Grid Fault Detection & Classification System

An enterprise-grade, SCADA control-room digital protection relay, power quality analyzer, and transient fault classifier for high-voltage transmission networks (400 kV Feeder L-401).

---

## ⚡ Core System Architecture

The system operates as a hardware-in-the-loop (HIL) digital relay prototype:
1. **Electromagnetic Transient (EMT) Engine**: Synthesizes 3-phase voltage ($V_a, V_b, V_c$) and current ($I_a, I_b, I_c$) waveforms with decaying DC offsets, high-frequency traveling waves, and realistic Gaussian grid noise.
2. **Discrete Wavelet Transform (DWT)**: Utilizes the `db4` Daubechies mother wavelet across 3 decomposition levels (D1, D2, D3, A3) to extract transient energy spectral densities, detail-level standard deviations, zero-sequence imbalance, and phase-to-phase differential metrics (98-dimensional feature vector per 64-sample sliding window).
3. **AI Classification & Distance Regressor**: Multi-class Random Forest (150 estimators) classifying 11 distinct transmission fault topologies with **100.0% validation accuracy**, paired with an ExtraTrees fault location regressor estimating distance in kilometers.
4. **Live Grid Telemetry Modulator**: Asynchronously integrates with the UK National Grid carbon intensity API (`https://api.carbonintensity.org.uk/intensity`) to dynamically modulate background grid frequency and stress levels.
5. **Enterprise Multi-View SCADA Frontend**: Built with React 18, Vite 5, Tailwind CSS, and `react-router-dom`. Implements an authentic matte charcoal (`#090d16`) control-room aesthetic with persistent global telemetry and 3 dedicated view tabs.

---

## 🖥️ 3-Page Enterprise Multi-View Architecture

### Page 1: Live SCADA Control Center (`/` or `/control`)
Focus on real-time grid monitoring and dynamic fault injection:
- **Real-Time Dual-Beam Oscilloscope**: Live 3-phase voltage ($V_a, V_b, V_c$) and current ($I_a, I_b, I_c$) waveforms (p.u. and absolute kV/kA).
- **400kV Substation Single Line Diagram (SLD)**: Interactive vector SLD with circuit breaker contacts (CB-401) and animated fault distance markers.
- **Digital Protection Relay Panel**: ANSI 50/51/21 instant status, fault taxonomy classification badge, confidence score, estimated distance, and loop impedance.
- **Operator Fault Injection Console**: 11-class fault injection matrix with distance slider (5–95 km), arc resistance slider (0.1–30 $\Omega$), random drill generator, and renewable generation mix (Solar PV / Wind DFIG).

### Page 2: Signal Processing & AI Analytics (`/analytics`)
Focus on deep electrical signal features, harmonics, and AI diagnostics:
- **DWT Spectral Energy Matrix**: Daubechies 4 (`db4`) decomposition energy levels (D1, D2, D3, A3) across all 3 phases.
- **Polar Phasor Vector Diagram**: Dynamic canvas displaying complex 3-phase voltage and current phasors with angle and magnitude tracking.
- **Power Quality & Harmonic Analyzer**: IEEE 519-2022 FFT calculator with THD % meters, Crest Factor, and 3rd, 5th, 7th, 9th, 11th harmonic order bars with regulatory limits.
- **AI Classifier Feature Importance Card**: Real-time Gini feature importances ($V_{ca,rms}, V_{bc,rms}, V_{b,rms}$, $D_1$ energy), certainty meter, and architecture specifications.
- **Live Grid Telemetry**: UK National Grid generation mix breakdown and grid stress index.

### Page 3: Event Logs & Relay Reports (`/reports`)
Focus on historical sequence of events (SOE) and compliance report generation:
- **Full-Screen Sequence of Events (SOE) Audit Trail**: Millisecond-resolution event records with multi-criteria filtering (search keyword, severity: TRIP / WARNING / NORMAL, and phase involvement: A, B, C, 3P).
- **Forensic Analytics KPI Cards**: Total recorded events, protective trips count, average trip latency gauge (sub-cycle clearance), and breaker lockout state.
- **One-Click Substation Relay Report Exporter**:
  - `EXPORT RELAY REPORT (PDF)` - Opens printable SCADA analytical report in new window with print-optimized CSS.
  - `JSON REPORT` - Downloads structured JSON for SCADA EMS / Historian ingestion.
  - `CSV EXPORT` - Exports active filtered audit logs to CSV.

---

## 🛡️ Supported Fault Taxonomy (11 Classes)

| Class | Code | Taxonomy | ANSI Protection Code | Description |
|---|---|---|---|---|
| **0** | `NORMAL` | Normal Grid State | ANSI 50/51 Normal | Steady-state balanced 3-phase operation |
| **1** | `LG-AG` | Phase A to Ground | ANSI 21/50G Phase A-G | Single line-to-ground fault on Phase A |
| **2** | `LG-BG` | Phase B to Ground | ANSI 21/50G Phase B-G | Single line-to-ground fault on Phase B |
| **3** | `LG-CG` | Phase C to Ground | ANSI 21/50G Phase C-G | Single line-to-ground fault on Phase C |
| **4** | `LL-AB` | Phase A to Phase B | ANSI 21/50 Phase A-B | Line-to-line fault between phases A and B |
| **5** | `LL-BC` | Phase B to Phase C | ANSI 21/50 Phase B-C | Line-to-line fault between phases B and C |
| **6** | `LL-CA` | Phase C to Phase A | ANSI 21/50 Phase C-A | Line-to-line fault between phases C and A |
| **7** | `LLG-ABG` | Double Line-to-Ground | ANSI 21/50N Phase AB-G | Phases A and B grounded simultaneously |
| **8** | `LLG-BCG` | Double Line-to-Ground | ANSI 21/50N Phase BC-G | Phases B and C grounded simultaneously |
| **9** | `LLG-CAG` | Double Line-to-Ground | ANSI 21/50N Phase CA-G | Phases C and A grounded simultaneously |
| **10** | `LLL-ABC` | Symmetrical 3-Phase Fault | ANSI 21/50/51 3-Phase | Severe symmetrical bolted 3-phase fault |

---

## 🚀 Quick Start Guide

### One-Click Startup (Windows)
Double-click:
```bat
START_ALL.bat
```
This batch script launches the FastAPI backend on port 8000, Vite dev server on port 5173, and opens your default browser to `http://localhost:5173`.

---

### Manual Startup

#### 1. Backend Service
```bash
cd backend
python run.py
```
- **REST Endpoints**:
  - `GET /api/fault-status` - Active relay status, trip details, and distance
  - `GET /api/export-report?format=html` - Printable SCADA Forensic Report (PDF)
  - `GET /api/export-report?format=json` - Structured JSON SOE Report
  - `GET /api/power-quality` - Real-time IEEE 519 FFT THD & harmonics
  - `POST /api/renewable-config` - Dynamic solar/wind penetration
  - `POST /api/inverter-transient` - Trigger inverter commutation transient
- **Swagger Documentation**: `http://localhost:8000/docs`
- **WebSocket Feed**: `ws://localhost:8000/ws/waveform-stream`

#### 2. Frontend Application
```bash
cd frontend
npm run dev
```
- Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Backend Verification Suite (10 Tests)
```bash
python backend/test_api.py
```
Runs the complete 10-stage test pipeline verifying:
1. DWT PyWavelets db4 feature extraction
2. 11-class synthetic EMT waveform generator
3. AI Random Forest Classifier inference
4. Real-time simulation step engine
5. Live grid telemetry integration
6. Model metrics validation
7. Renewable generation service (Solar + Wind)
8. Power quality FFT & THD calculator (IEEE 519)
9. Automated forensic report generator (JSON & HTML)
10. Classifier robustness with 50% solar + 50% wind + active inverter transients
