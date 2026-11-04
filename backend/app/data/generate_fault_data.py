import numpy as np
from typing import Dict, List, Tuple, Optional
import math
from app.config import (
    FAULT_CLASSES,
    GRID_NOMINAL_FREQ,
    SAMPLING_FREQ,
    LINE_LENGTH_KM,
    WINDOW_SIZE
)
from app.services.wavelet import extract_features_from_window

class PowerGridFaultSimulator:
    """
    Simulates realistic 3-phase electromagnetic transients and fault waveforms
    for an electric power transmission network based on transmission line impedance,
    traveling wave reflections, DC offset decays, and varying fault characteristics.
    """
    def __init__(self, f_nom: float = GRID_NOMINAL_FREQ, fs: float = SAMPLING_FREQ):
        self.f_nom = f_nom
        self.fs = fs
        self.omega = 2.0 * math.pi * self.f_nom
        self.dt = 1.0 / self.fs
        
        # Transmission line parameters (distributed per km)
        self.r_line = 0.035   # Ohms / km
        self.l_line = 1.05e-3 # Henrys / km
        self.c_line = 11.5e-9 # Farads / km
        self.line_length = LINE_LENGTH_KM  # 100 km
        
        # Source equivalent impedance
        self.r_source = 0.5   # Ohms
        self.l_source = 15.0e-3 # Henrys
        
        # Load parameters (per unit baseline)
        self.v_nominal_peak = 1.0   # p.u.
        self.i_nominal_peak = 1.0   # p.u.
        self.power_factor = 0.92    # lagging
        self.load_phase_angle = -math.acos(self.power_factor)

    def generate_waveform(
        self,
        fault_class: int,
        duration_sec: float = 0.16,      # ~8 cycles at 50Hz
        fault_start_time: float = 0.06,  # fault occurs after 3 cycles
        distance_km: float = 45.0,
        fault_resistance: float = 2.5,   # Ohms
        inception_angle_deg: float = 45.0,
        noise_level_db: float = 38.0,
        grid_freq_jitter: float = 0.0,
        stress_factor: float = 1.0
    ) -> Dict[str, np.ndarray]:
        """
        Generates full 3-phase voltage and current waveforms with realistic
        DC decay transients, high-frequency traveling waves, and harmonic noise.
        """
        num_samples = int(duration_sec * self.fs)
        t = np.linspace(0.0, duration_sec, num_samples, endpoint=False)
        
        f_actual = self.f_nom + grid_freq_jitter
        omega_actual = 2.0 * math.pi * f_actual
        
        # Inception phase offset
        phi_0 = math.radians(inception_angle_deg)
        
        # Normal 3-phase voltages (120 deg balanced displacement)
        va_pre = self.v_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0)
        vb_pre = self.v_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0 - 2.0 * math.pi / 3.0)
        vc_pre = self.v_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0 + 2.0 * math.pi / 3.0)
        
        # Normal 3-phase load currents
        ia_pre = self.i_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0 + self.load_phase_angle)
        ib_pre = self.i_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0 - 2.0 * math.pi / 3.0 + self.load_phase_angle)
        ic_pre = self.i_nominal_peak * stress_factor * np.sin(omega_actual * t + phi_0 + 2.0 * math.pi / 3.0 + self.load_phase_angle)
        
        va = va_pre.copy()
        vb = vb_pre.copy()
        vc = vc_pre.copy()
        ia = ia_pre.copy()
        ib = ib_pre.copy()
        ic = ic_pre.copy()
        
        # If normal (class 0), return pure baseline + noise
        if fault_class == 0:
            va, vb, vc, ia, ib, ic = self._inject_grid_noise(
                va, vb, vc, ia, ib, ic, noise_level_db
            )
            return {
                "t": t, "Va": va, "Vb": vb, "Vc": vc,
                "Ia": ia, "Ib": ib, "Ic": ic,
                "fault_class": 0, "fault_active": np.zeros(num_samples, dtype=bool),
                "distance_km": 0.0, "resistance_ohm": 0.0
            }
            
        fault_idx = int(fault_start_time * self.fs)
        fault_mask = np.zeros(num_samples, dtype=bool)
        fault_mask[fault_idx:] = True
        
        t_fault = t[fault_idx:] - fault_start_time
        
        # Total impedance to fault point
        # Z_loop = Z_source + (distance_km * z_line) + Rf
        r_total = self.r_source + (distance_km * self.r_line) + fault_resistance
        l_total = self.l_source + (distance_km * self.l_line)
        x_total = omega_actual * l_total
        z_mag = math.sqrt(r_total**2 + x_total**2)
        theta_z = math.atan2(x_total, r_total)
        tau_dc = l_total / max(r_total, 1e-4) # Time constant for DC decaying offset
        
        # Voltage drop factor at relay terminal based on line impedance divider
        # V_terminal = V_source * (Z_line_to_fault + Rf) / (Z_source + Z_line_to_fault + Rf)
        z_downstream = math.sqrt((distance_km * self.r_line + fault_resistance)**2 + (distance_km * x_total / max(distance_km, 1.0))**2)
        v_drop_ratio = max(0.05, min(0.85, z_downstream / (z_mag + 0.1)))
        
        # Short circuit current scale (normalized to nominal, typically 3x to 12x)
        # S_sc proportional to 1 / z_mag
        isc_scale = max(2.5, min(14.0, (self.v_nominal_peak * 35.0) / (z_mag * 1.5)))
        
        # High frequency traveling wave transient (arising at inception)
        f_hf = max(250.0, min(1200.0, 300000.0 / (4.0 * max(distance_km, 5.0)))) # wave speed ~ 300,000 km/s
        hf_transient = np.sin(2.0 * math.pi * f_hf * t_fault) * np.exp(-t_fault / 0.008) * (1.2 / max(distance_km, 10.0))
        
        # Class specifics
        # 1-3: LG (AG, BG, CG)
        # 4-6: LL (AB, BC, CA)
        # 7-9: LLG (ABG, BCG, CAG)
        # 10: LLL / LLLG
        
        def calculate_fault_current(phase_angle_offset):
            # i(t) = Isc * sin(omega*t + phi - theta) - Isc * sin(phi - theta)*exp(-t/tau)
            inception_inst_angle = phi_0 + phase_angle_offset
            ac_comp = isc_scale * np.sin(omega_actual * t_fault + inception_inst_angle - theta_z)
            dc_offset = -isc_scale * np.sin(inception_inst_angle - theta_z) * np.exp(-t_fault / tau_dc)
            return ac_comp + dc_offset + hf_transient * isc_scale * 0.3
            
        def calculate_fault_voltage(phase_angle_offset):
            inception_inst_angle = phi_0 + phase_angle_offset
            v_fault_ac = self.v_nominal_peak * v_drop_ratio * np.sin(omega_actual * t_fault + inception_inst_angle)
            return v_fault_ac + hf_transient * 0.4
            
        if fault_class == 1: # AG
            va[fault_idx:] = calculate_fault_voltage(0.0)
            ia[fault_idx:] = calculate_fault_current(0.0)
            # Slight voltage rise on healthy phases
            vb[fault_idx:] *= 1.05
            vc[fault_idx:] *= 1.05
            
        elif fault_class == 2: # BG
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0)
            ib[fault_idx:] = calculate_fault_current(-2.0 * math.pi / 3.0)
            va[fault_idx:] *= 1.05
            vc[fault_idx:] *= 1.05
            
        elif fault_class == 3: # CG
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0)
            ic[fault_idx:] = calculate_fault_current(2.0 * math.pi / 3.0)
            va[fault_idx:] *= 1.05
            vb[fault_idx:] *= 1.05
            
        elif fault_class == 4: # LL: AB
            va[fault_idx:] = calculate_fault_voltage(0.0) * 0.65
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0) * 0.65
            i_diff = calculate_fault_current(0.0)
            ia[fault_idx:] = i_diff
            ib[fault_idx:] = -i_diff  # Anti-phase, no ground path
            
        elif fault_class == 5: # LL: BC
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0) * 0.65
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0) * 0.65
            i_diff = calculate_fault_current(-2.0 * math.pi / 3.0)
            ib[fault_idx:] = i_diff
            ic[fault_idx:] = -i_diff
            
        elif fault_class == 6: # LL: CA
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0) * 0.65
            va[fault_idx:] = calculate_fault_voltage(0.0) * 0.65
            i_diff = calculate_fault_current(2.0 * math.pi / 3.0)
            ic[fault_idx:] = i_diff
            ia[fault_idx:] = -i_diff
            
        elif fault_class == 7: # LLG: ABG
            va[fault_idx:] = calculate_fault_voltage(0.0) * 0.4
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0) * 0.4
            ia[fault_idx:] = calculate_fault_current(0.0) * 1.15
            ib[fault_idx:] = calculate_fault_current(-2.0 * math.pi / 3.0) * 1.15
            
        elif fault_class == 8: # LLG: BCG
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0) * 0.4
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0) * 0.4
            ib[fault_idx:] = calculate_fault_current(-2.0 * math.pi / 3.0) * 1.15
            ic[fault_idx:] = calculate_fault_current(2.0 * math.pi / 3.0) * 1.15
            
        elif fault_class == 9: # LLG: CAG
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0) * 0.4
            va[fault_idx:] = calculate_fault_voltage(0.0) * 0.4
            ic[fault_idx:] = calculate_fault_current(2.0 * math.pi / 3.0) * 1.15
            ia[fault_idx:] = calculate_fault_current(0.0) * 1.15
            
        elif fault_class == 10: # LLL / LLLG: 3-Phase severe symmetrical
            va[fault_idx:] = calculate_fault_voltage(0.0) * 0.15
            vb[fault_idx:] = calculate_fault_voltage(-2.0 * math.pi / 3.0) * 0.15
            vc[fault_idx:] = calculate_fault_voltage(2.0 * math.pi / 3.0) * 0.15
            ia[fault_idx:] = calculate_fault_current(0.0) * 1.35
            ib[fault_idx:] = calculate_fault_current(-2.0 * math.pi / 3.0) * 1.35
            ic[fault_idx:] = calculate_fault_current(2.0 * math.pi / 3.0) * 1.35
            
        va, vb, vc, ia, ib, ic = self._inject_grid_noise(
            va, vb, vc, ia, ib, ic, noise_level_db
        )
        
        return {
            "t": t, "Va": va, "Vb": vb, "Vc": vc,
            "Ia": ia, "Ib": ib, "Ic": ic,
            "fault_class": fault_class, "fault_active": fault_mask,
            "distance_km": distance_km, "resistance_ohm": fault_resistance
        }

    def _inject_grid_noise(self, va, vb, vc, ia, ib, ic, snr_db: float):
        """Injects measurement noise and 3rd/5th power harmonics."""
        noise_std_v = 10.0 ** (-snr_db / 20.0) * self.v_nominal_peak
        noise_std_i = 10.0 ** (-snr_db / 20.0) * self.i_nominal_peak
        
        # Add slight 3rd harmonic (1.5%) and 5th harmonic (0.8%)
        t_arr = np.linspace(0, len(va) * self.dt, len(va), endpoint=False)
        h3 = 0.015 * np.sin(3.0 * self.omega * t_arr)
        h5 = 0.008 * np.sin(5.0 * self.omega * t_arr)
        
        va = va + np.random.normal(0, noise_std_v, len(va)) + h3
        vb = vb + np.random.normal(0, noise_std_v, len(vb)) + h3
        vc = vc + np.random.normal(0, noise_std_v, len(vc)) + h3
        
        ia = ia + np.random.normal(0, noise_std_i, len(ia)) + h3 * 0.5 + h5
        ib = ib + np.random.normal(0, noise_std_i, len(ib)) + h3 * 0.5 + h5
        ic = ic + np.random.normal(0, noise_std_i, len(ic)) + h3 * 0.5 + h5
        
        return va, vb, vc, ia, ib, ic

def generate_training_dataset(samples_per_class: int = 150) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Generates a rich, diversified training dataset spanning all 11 fault classes,
    varying distances (5 km to 95 km), fault resistances (0.1 to 35 ohms),
    and inception angles (0 to 360 degrees).
    
    Returns:
        X: Feature matrix of extracted DWT & statistical metrics
        y_class: Multi-class target labels (0 to 10)
        y_dist: Continuous distance targets (km)
    """
    sim = PowerGridFaultSimulator()
    X_list = []
    y_class_list = []
    y_dist_list = []
    
    print(f"Generating synthetic power grid dataset ({samples_per_class * 11} total samples)...")
    
    # Pre-seed random generator for reproducible high-grade model
    rng = np.random.RandomState(42)
    
    for cls_id in range(11):
        for _ in range(samples_per_class):
            if cls_id == 0:
                dist = 0.0
                rf = 0.0
                inc_ang = rng.uniform(0.0, 360.0)
                stress = rng.uniform(0.92, 1.08)
                freq_jitter = rng.uniform(-0.06, 0.06)
                noise_db = rng.uniform(32.0, 48.0)
                
                # Normal waveform
                wf = sim.generate_waveform(
                    fault_class=0,
                    duration_sec=0.10,
                    fault_start_time=0.04,
                    distance_km=0.0,
                    fault_resistance=0.0,
                    inception_angle_deg=inc_ang,
                    noise_level_db=noise_db,
                    grid_freq_jitter=freq_jitter,
                    stress_factor=stress
                )
                # Take window
                win = {ch: wf[ch][-WINDOW_SIZE:] for ch in ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]}
            else:
                dist = rng.uniform(5.0, 95.0)
                rf = rng.uniform(0.1, 35.0)
                inc_ang = rng.uniform(0.0, 360.0)
                stress = rng.uniform(0.94, 1.06)
                freq_jitter = rng.uniform(-0.05, 0.05)
                noise_db = rng.uniform(32.0, 45.0)
                
                # Fault waveform
                wf = sim.generate_waveform(
                    fault_class=cls_id,
                    duration_sec=0.10,
                    fault_start_time=0.04,
                    distance_km=dist,
                    fault_resistance=rf,
                    inception_angle_deg=inc_ang,
                    noise_level_db=noise_db,
                    grid_freq_jitter=freq_jitter,
                    stress_factor=stress
                )
                # Take window right after fault inception to capture transient wave
                fault_idx = int(0.04 * sim.fs)
                win_start = fault_idx + rng.randint(0, 15)
                win = {ch: wf[ch][win_start:win_start + WINDOW_SIZE] for ch in ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]}
            
            features = extract_features_from_window(win)
            X_list.append(features)
            y_class_list.append(cls_id)
            y_dist_list.append(dist)
            
    X = np.array(X_list, dtype=np.float64)
    y_class = np.array(y_class_list, dtype=np.int32)
    y_dist = np.array(y_dist_list, dtype=np.float32)
    
    print(f"Dataset generated. Feature vector dimensions: {X.shape}")
    return X, y_class, y_dist

if __name__ == "__main__":
    X, y_c, y_d = generate_training_dataset(samples_per_class=10)
    print(f"Sample test successful. X shape: {X.shape}, y_class shape: {y_c.shape}")

