import time
import math
import random
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import deque

from app.config import (
    GRID_NOMINAL_FREQ,
    SAMPLING_FREQ,
    WINDOW_SIZE,
    FAULT_CLASSES
)
from app.services.wavelet import extract_features_from_window, get_live_wavelet_spectrum
from app.services.classifier import classifier_service
from app.services.live_grid_api import grid_telemetry
from app.services.renewable import renewable_service
from app.services.harmonics import harmonics_calculator

class GridWaveformEngine:
    """
    Real-time continuous 3-phase electromagnetic transient generator
    and protective relay simulator.
    """
    def __init__(self):
        self.fs = SAMPLING_FREQ  # 2000 Hz
        self.dt = 1.0 / self.fs
        self.sample_counter = 0
        self.t = 0.0
        
        # Buffer for sliding window analysis (keeps last 256 samples)
        self.buffer_size = 256
        self.va_buf = deque(maxlen=self.buffer_size)
        self.vb_buf = deque(maxlen=self.buffer_size)
        self.vc_buf = deque(maxlen=self.buffer_size)
        self.ia_buf = deque(maxlen=self.buffer_size)
        self.ib_buf = deque(maxlen=self.buffer_size)
        self.ic_buf = deque(maxlen=self.buffer_size)
        
        # Fault injection state
        self.active_fault_class = 0
        self.fault_distance_km = 45.0
        self.fault_resistance = 2.0
        self.fault_inception_sample = 0
        self.fault_duration_samples = 0
        self.is_fault_injected = False
        
        # Protective relay latch state
        self.relay_tripped = False
        self.trip_timestamp: Optional[str] = None
        self.trip_details: Dict[str, Any] = {}
        self.trip_latency_ms: float = 0.0
        self.breaker_state = "CLOSED"  # CLOSED, OPEN, TRIPPED
        
        # Line base parameters
        self.v_base_kv = 400.0  # 400 kV line
        self.i_base_ka = 1.25   # 1.25 kA nominal
        
        # Advanced Modules Storage
        self.latest_power_quality: Dict[str, Any] = {}
        self.latest_renewable_telemetry: Dict[str, Any] = {}
        self.event_history: List[Dict[str, Any]] = []
        
        # Pre-fill buffer with normal waveforms
        self._prefill_buffer()

    def _prefill_buffer(self):
        omega = 2.0 * math.pi * GRID_NOMINAL_FREQ
        for i in range(self.buffer_size):
            t_curr = i * self.dt
            va = math.sin(omega * t_curr)
            vb = math.sin(omega * t_curr - 2.0 * math.pi / 3.0)
            vc = math.sin(omega * t_curr + 2.0 * math.pi / 3.0)
            ia = math.sin(omega * t_curr - 0.4)
            ib = math.sin(omega * t_curr - 2.0 * math.pi / 3.0 - 0.4)
            ic = math.sin(omega * t_curr + 2.0 * math.pi / 3.0 - 0.4)
            self.va_buf.append(va)
            self.vb_buf.append(vb)
            self.vc_buf.append(vc)
            self.ia_buf.append(ia)
            self.ib_buf.append(ib)
            self.ic_buf.append(ic)
        self.sample_counter = self.buffer_size
        self.t = self.buffer_size * self.dt

    def inject_fault(
        self,
        fault_class: int,
        distance_km: float = 40.0,
        resistance_ohm: float = 2.5,
        duration_ms: float = 300.0
    ):
        """Operator or test API fault injection."""
        self.active_fault_class = fault_class
        self.fault_distance_km = max(2.0, min(98.0, distance_km))
        self.fault_resistance = max(0.1, min(50.0, resistance_ohm))
        self.fault_inception_sample = self.sample_counter
        self.fault_duration_samples = int((duration_ms / 1000.0) * self.fs)
        self.is_fault_injected = (fault_class > 0)
        
        # Breaker recloses if clearing fault
        if fault_class == 0:
            self.clear_fault()

    def clear_fault(self):
        """Clears active fault condition."""
        self.active_fault_class = 0
        self.is_fault_injected = False
        self.fault_duration_samples = 0

    def reset_relay(self):
        """Operator resets protective relay lockout / latch."""
        self.relay_tripped = False
        self.trip_timestamp = None
        self.trip_details = {}
        self.breaker_state = "CLOSED"
        self.clear_fault()
        self.event_history.insert(0, {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "severity": "NORMAL",
            "ansi": "NORMAL",
            "message": "BREAKER RECLOSED - RELAY SYSTEM RESTORED TO HEALTHY STATE",
            "distance": None,
            "latency": None
        })

    def step(self, num_samples: int = 10) -> Dict[str, Any]:
        """
        Advances grid time by `num_samples` (e.g. 10 samples = 5ms at 2kHz)
        and computes AI classification and protective relay state.
        """
        grid_status = grid_telemetry.get_status()
        freq = grid_status.get("grid_frequency_hz", 50.0)
        stress = grid_status.get("grid_stress_level", 0.2)
        load_factor = grid_status.get("grid_load_factor", 0.8)
        
        omega = 2.0 * math.pi * freq
        voltage_scale = 1.0 - (stress * 0.02) # slight voltage regulation variation
        current_scale = load_factor * 1.15
        
        frame_points = []
        
        for _ in range(num_samples):
            self.sample_counter += 1
            self.t += self.dt
            
            # Check fault expiry
            if self.is_fault_injected:
                elapsed_samples = self.sample_counter - self.fault_inception_sample
                if elapsed_samples > self.fault_duration_samples and self.fault_duration_samples > 0:
                    self.clear_fault()
                    
            # Base voltages & currents
            va = voltage_scale * math.sin(omega * self.t)
            vb = voltage_scale * math.sin(omega * self.t - 2.0 * math.pi / 3.0)
            vc = voltage_scale * math.sin(omega * self.t + 2.0 * math.pi / 3.0)
            
            ia = current_scale * math.sin(omega * self.t - 0.4)
            ib = current_scale * math.sin(omega * self.t - 2.0 * math.pi / 3.0 - 0.4)
            ic = current_scale * math.sin(omega * self.t + 2.0 * math.pi / 3.0 - 0.4)
            
            # If breaker opened due to trip lockout, disconnect transmission current
            if self.breaker_state == "OPEN" or self.breaker_state == "TRIPPED":
                ia = ia * 0.02 + random.gauss(0, 0.005)
                ib = ib * 0.02 + random.gauss(0, 0.005)
                ic = ic * 0.02 + random.gauss(0, 0.005)
            elif self.is_fault_injected and self.active_fault_class > 0:
                elapsed_samples = self.sample_counter - self.fault_inception_sample
                t_fault = elapsed_samples * self.dt
                
                # Impedance factor
                d = self.fault_distance_km
                rf = self.fault_resistance
                z_mag = math.sqrt((0.5 + d * 0.035 + rf)**2 + (0.015 * omega + d * 1.05e-3 * omega)**2)
                isc_mult = max(3.0, min(12.0, 35.0 / (z_mag + 0.5)))
                
                # High frequency traveling wave pulse at inception
                hf_surge = math.sin(2.0 * math.pi * 650.0 * t_fault) * math.exp(-t_fault / 0.012) * 2.5
                v_drop = max(0.08, min(0.65, (d * 0.035 + rf) / (z_mag + 0.1)))
                
                # Apply fault pattern
                fc = self.active_fault_class
                if fc == 1:  # AG
                    va = va * v_drop + hf_surge * 0.15
                    ia = ia * isc_mult + hf_surge
                elif fc == 2:  # BG
                    vb = vb * v_drop + hf_surge * 0.15
                    ib = ib * isc_mult + hf_surge
                elif fc == 3:  # CG
                    vc = vc * v_drop + hf_surge * 0.15
                    ic = ic * isc_mult + hf_surge
                elif fc == 4:  # AB
                    va = va * 0.55
                    vb = vb * 0.55
                    i_sc = isc_mult * math.sin(omega * self.t) + hf_surge
                    ia = i_sc
                    ib = -i_sc
                elif fc == 5:  # BC
                    vb = vb * 0.55
                    vc = vc * 0.55
                    i_sc = isc_mult * math.sin(omega * self.t - 2.0 * math.pi / 3.0) + hf_surge
                    ib = i_sc
                    ic = -i_sc
                elif fc == 6:  # CA
                    vc = vc * 0.55
                    va = va * 0.55
                    i_sc = isc_mult * math.sin(omega * self.t + 2.0 * math.pi / 3.0) + hf_surge
                    ic = i_sc
                    ia = -i_sc
                elif fc == 7:  # ABG
                    va = va * 0.35
                    vb = vb * 0.35
                    ia = ia * isc_mult * 1.1 + hf_surge
                    ib = ib * isc_mult * 1.1 + hf_surge
                elif fc == 8:  # BCG
                    vb = vb * 0.35
                    vc = vc * 0.35
                    ib = ib * isc_mult * 1.1 + hf_surge
                    ic = ic * isc_mult * 1.1 + hf_surge
                elif fc == 9:  # CAG
                    vc = vc * 0.35
                    va = va * 0.35
                    ic = ic * isc_mult * 1.1 + hf_surge
                    ia = ia * isc_mult * 1.1 + hf_surge
                elif fc == 10:  # LLL / LLLG
                    va = va * 0.12
                    vb = vb * 0.12
                    vc = vc * 0.12
                    ia = ia * isc_mult * 1.35 + hf_surge
                    ib = ib * isc_mult * 1.35 + hf_surge
                    ic = ic * isc_mult * 1.35 + hf_surge
                    
            # Measurement noise
            noise_v = random.gauss(0, 0.008)
            noise_i = random.gauss(0, 0.008)
            va += noise_v
            vb += noise_v
            vc += noise_v
            ia += noise_i
            ib += noise_i
            ic += noise_i
            
            # Module 1: Dynamic Renewable Generation (Solar PV + Wind) Injection Modulation
            (dVa, dVb, dVc), (dIa, dIb, dIc), ren_telemetry = renewable_service.compute_injection(self.t, self.dt)
            va += dVa
            vb += dVb
            vc += dVc
            if self.breaker_state != "OPEN" and self.breaker_state != "TRIPPED":
                ia += dIa
                ib += dIb
                ic += dIc
            
            self.va_buf.append(va)
            self.vb_buf.append(vb)
            self.vc_buf.append(vc)
            self.ia_buf.append(ia)
            self.ib_buf.append(ib)
            self.ic_buf.append(ic)
            
            frame_points.append({
                "sample": self.sample_counter,
                "t_ms": round(self.t * 1000.0, 2),
                "Va": round(va, 4),
                "Vb": round(vb, 4),
                "Vc": round(vc, 4),
                "Ia": round(ia, 4),
                "Ib": round(ib, 4),
                "Ic": round(ic, 4),
                "Va_kV": round(va * (self.v_base_kv / math_sqrt_3), 2),
                "Ia_kA": round(ia * self.i_base_ka, 2)
            })
            
        # Run AI Classifier on latest sliding window (last 64 samples)
        window = {
            "Va": np.array(list(self.va_buf)[-WINDOW_SIZE:]),
            "Vb": np.array(list(self.vb_buf)[-WINDOW_SIZE:]),
            "Vc": np.array(list(self.vc_buf)[-WINDOW_SIZE:]),
            "Ia": np.array(list(self.ia_buf)[-WINDOW_SIZE:]),
            "Ib": np.array(list(self.ib_buf)[-WINDOW_SIZE:]),
            "Ic": np.array(list(self.ic_buf)[-WINDOW_SIZE:])
        }
        
        classification = classifier_service.classify_window(window)
        wavelet_spectrum = get_live_wavelet_spectrum(window)
        
        # Module 2: Fast Fourier Transform (FFT) Power Quality & Harmonic (THD) Calculator
        pq_analysis = harmonics_calculator.compute_all_channels(window)
        self.latest_power_quality = pq_analysis
        self.latest_renewable_telemetry = ren_telemetry

        # Trip Logic & Breaker state machine
        if classification["trip_signal"] and not self.relay_tripped:
            self.relay_tripped = True
            self.breaker_state = "TRIPPED"
            self.trip_timestamp = datetime.utcnow().isoformat() + "Z"
            # Trip latency is measured from fault injection to trip trigger (typically 12-25ms)
            elapsed_ms = (self.sample_counter - self.fault_inception_sample) * (1000.0 / self.fs)
            self.trip_latency_ms = round(max(8.0, min(35.0, elapsed_ms)), 2)
            self.trip_details = {
                "fault_class": classification["class_id"],
                "fault_name": classification["name"],
                "category": classification["category"],
                "ansi_code": classification["ansi_code"],
                "distance_km": classification["estimated_distance_km"],
                "protection_zone": classification["protection_zone"],
                "impedance_ohm": classification["estimated_impedance_ohm"],
                "trip_latency_ms": self.trip_latency_ms,
                "trip_time": self.trip_timestamp
            }
            # Record in event history
            self.event_history.insert(0, {
                "timestamp": self.trip_timestamp,
                "severity": "TRIP",
                "ansi": classification["ansi_code"],
                "message": f"PROTECTIVE TRIP: {classification['name']} at {classification['estimated_distance_km']} km",
                "distance": classification["estimated_distance_km"],
                "latency": self.trip_latency_ms
            })
            if len(self.event_history) > 200:
                self.event_history = self.event_history[:200]
            
        # Overcurrent ANSI 50 backup logic
        i_max = max(abs(frame_points[-1]["Ia"]), abs(frame_points[-1]["Ib"]), abs(frame_points[-1]["Ic"]))
        if i_max > 3.0 and not self.relay_tripped:
            self.relay_tripped = True
            self.breaker_state = "TRIPPED"
            self.trip_timestamp = datetime.utcnow().isoformat() + "Z"
            self.trip_latency_ms = 12.5
            self.event_history.insert(0, {
                "timestamp": self.trip_timestamp,
                "severity": "TRIP",
                "ansi": "ANSI 50",
                "message": "ANSI 50 INSTANTANEOUS OVERCURRENT TRIP (I > 3.0 pu)",
                "distance": 0.0,
                "latency": 12.5
            })
            
        # Current active status
        trip_status = {
            "relay_tripped": self.relay_tripped,
            "breaker_state": self.breaker_state,
            "trip_latency_ms": self.trip_latency_ms,
            "trip_timestamp": self.trip_timestamp,
            "trip_details": self.trip_details if self.relay_tripped else None
        }
        
        return {
            "type": "TELEMETRY_FRAME",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "sample_index": self.sample_counter,
            "points": frame_points,
            "classification": classification,
            "wavelet_spectrum": wavelet_spectrum,
            "power_quality": pq_analysis,
            "renewable_telemetry": ren_telemetry,
            "trip_status": trip_status,
            "grid_telemetry": grid_status
        }

    def get_latest_power_quality(self) -> Dict[str, Any]:
        if not self.latest_power_quality:
            window = {
                "Va": np.array(list(self.va_buf)[-WINDOW_SIZE:]),
                "Vb": np.array(list(self.vb_buf)[-WINDOW_SIZE:]),
                "Vc": np.array(list(self.vc_buf)[-WINDOW_SIZE:]),
                "Ia": np.array(list(self.ia_buf)[-WINDOW_SIZE:]),
                "Ib": np.array(list(self.ib_buf)[-WINDOW_SIZE:]),
                "Ic": np.array(list(self.ic_buf)[-WINDOW_SIZE:])
            }
            self.latest_power_quality = harmonics_calculator.compute_all_channels(window)
        return self.latest_power_quality

    def get_latest_renewable_telemetry(self) -> Dict[str, Any]:
        if not self.latest_renewable_telemetry:
            self.latest_renewable_telemetry = renewable_service.get_telemetry()
        return self.latest_renewable_telemetry

    def get_event_history(self) -> List[Dict[str, Any]]:
        return self.event_history

math_sqrt_3 = 1.73205
grid_engine = GridWaveformEngine()

