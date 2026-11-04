"""
Renewable Generation Integration Module
Simulates dynamic Solar PV and Wind Turbine power injection modulation
into the high-voltage transmission grid (Feeder L-401).
Models inverter PWM switching harmonics, solar irradiance fluctuations,
and wind turbine rotor aerodynamic power variations.
"""

import math
import random
import time
from typing import Dict, Any, Tuple


class RenewableGenerationService:
    """
    Simulates utility-scale Solar PV farm (150 MW nominal)
    and Wind Turbine Farm (250 MW nominal) connected to 400kV bus.
    """
    def __init__(self):
        # Operational states
        self.solar_enabled: bool = True
        self.wind_enabled: bool = True
        self.solar_penetration: float = 0.25   # 25% of grid feeder capacity
        self.wind_penetration: float = 0.25    # 25% of grid feeder capacity
        
        # Nominal farm ratings
        self.solar_base_mw: float = 150.0
        self.wind_base_mw: float = 250.0
        self.feeder_nominal_mw: float = 600.0  # 400kV feeder nominal capacity
        
        # Inverter & physical dynamics state
        self.inverter_switching_freq: float = 1050.0  # Hz (typical multi-level grid inverter)
        self.inverter_transient_active: bool = False
        self.inverter_transient_start_t: float = 0.0
        self.inverter_transient_duration: float = 0.4  # seconds
        
        # Environmental variables
        self.solar_irradiance: float = 850.0   # W/m^2 (nominal standard test: 1000 W/m^2)
        self.wind_speed: float = 11.2          # m/s (rated wind speed: 12 m/s)
        self.blade_pass_freq: float = 1.45     # Hz (3 blades * 29 rpm / 60)
        
        # Internal cycle tracker
        self.last_update_t: float = 0.0

    def configure(
        self,
        solar_enabled: bool = None,
        wind_enabled: bool = None,
        solar_penetration: float = None,
        wind_penetration: float = None
    ) -> Dict[str, Any]:
        """Update renewable operational parameters."""
        if solar_enabled is not None:
            self.solar_enabled = bool(solar_enabled)
        if wind_enabled is not None:
            self.wind_enabled = bool(wind_enabled)
        if solar_penetration is not None:
            self.solar_penetration = max(0.0, min(0.60, float(solar_penetration)))
        if wind_penetration is not None:
            self.wind_penetration = max(0.0, min(0.60, float(wind_penetration)))
        return self.get_telemetry()

    def trigger_inverter_transient(self, duration_s: float = 0.4):
        """Simulate a sudden inverter ride-through or cloud shading transient."""
        self.inverter_transient_active = True
        self.inverter_transient_start_t = time.time()
        self.inverter_transient_duration = duration_s

    def compute_injection(self, t: float, dt: float) -> Tuple[Tuple[float, float, float], Tuple[float, float, float], Dict[str, Any]]:
        """
        Calculates instantaneous voltage and current modulation perturbations
        (dVa, dVb, dVc, dIa, dIb, dIc) in per-unit (p.u.) at time t.
        Returns:
            (dVa, dVb, dVc), (dIa, dIb, dIc), telemetry_dict
        """
        # 1. Update slow physical dynamics
        # Solar irradiance with small Gaussian fluctuations + cloud shading if transient active
        if self.inverter_transient_active:
            elapsed = time.time() - self.inverter_transient_start_t
            if elapsed > self.inverter_transient_duration:
                self.inverter_transient_active = False
                transient_factor = 0.0
            else:
                # Damped transient envelope
                transient_factor = math.sin(2.0 * math.pi * 35.0 * elapsed) * math.exp(-elapsed / 0.12)
        else:
            transient_factor = 0.0

        # Irradiance model (650 to 950 W/m^2)
        self.solar_irradiance = 820.0 + 80.0 * math.sin(2.0 * math.pi * 0.05 * t)
        if self.inverter_transient_active:
            self.solar_irradiance *= 0.65  # 35% dip during cloud edge

        # Wind speed model (gust variations)
        self.wind_speed = 11.0 + 1.5 * math.sin(2.0 * math.pi * 0.12 * t) + 0.4 * math.sin(2.0 * math.pi * 0.35 * t)
        
        # 2. Power computation (MW)
        solar_mw = (
            self.solar_base_mw * self.solar_penetration * (self.solar_irradiance / 1000.0)
            if self.solar_enabled else 0.0
        )
        
        # Wind cubic power curve below rated speed (capped at base rating)
        wind_fraction = min(1.0, (self.wind_speed / 12.0) ** 3)
        wind_mw = (
            self.wind_base_mw * self.wind_penetration * wind_fraction
            if self.wind_enabled else 0.0
        )
        
        total_renewable_mw = solar_mw + wind_mw
        renewable_pct = (total_renewable_mw / self.feeder_nominal_mw) * 100.0

        # 3. Voltage Perturbations (Inverter harmonics & wind blade-pass ripple)
        # Solar PV Inverter Harmonics:
        # 5th harmonic (250 Hz) and 7th harmonic (350 Hz) + high-frequency PWM switching carrier
        solar_mult = self.solar_penetration if self.solar_enabled else 0.0
        wind_mult = self.wind_penetration if self.wind_enabled else 0.0
        
        # Harmonic amplitudes proportional to inverter penetration (IEEE 519 compliant: ~1-2%)
        h5_amp = 0.012 * solar_mult
        h7_amp = 0.008 * solar_mult
        h_sw_amp = 0.005 * solar_mult
        
        # Wind aerodynamic torque ripple (1.45 Hz blade pass frequency)
        wind_ripple = 0.008 * wind_mult * math.sin(2.0 * math.pi * self.blade_pass_freq * t)
        
        omega_base = 2.0 * math.pi * 50.0
        omega_5 = 5.0 * omega_base
        omega_7 = 7.0 * omega_base
        omega_sw = 2.0 * math.pi * self.inverter_switching_freq
        
        # 3-phase negative sequence for 5th harmonic, positive sequence for 7th harmonic
        v_h5_a = h5_amp * math.sin(omega_5 * t)
        v_h5_b = h5_amp * math.sin(omega_5 * t + 2.0 * math.pi / 3.0)  # negative sequence
        v_h5_c = h5_amp * math.sin(omega_5 * t - 2.0 * math.pi / 3.0)
        
        v_h7_a = h7_amp * math.sin(omega_7 * t)
        v_h7_b = h7_amp * math.sin(omega_7 * t - 2.0 * math.pi / 3.0)  # positive sequence
        v_h7_c = h7_amp * math.sin(omega_7 * t + 2.0 * math.pi / 3.0)
        
        v_sw = h_sw_amp * math.sin(omega_sw * t)
        v_trans = 0.04 * transient_factor
        
        dVa = v_h5_a + v_h7_a + v_sw + wind_ripple + v_trans
        dVb = v_h5_b + v_h7_b + v_sw + wind_ripple - (v_trans * 0.5)
        dVc = v_h5_c + v_h7_c + v_sw + wind_ripple - (v_trans * 0.5)
        
        # 4. Current Injection Perturbations
        # Renewable power increases net feed-in current and adds inverter current ripple
        i_ren_scale = (total_renewable_mw / self.feeder_nominal_mw) * 0.25
        i_h5_amp = 0.018 * (solar_mult + wind_mult)
        i_h7_amp = 0.011 * (solar_mult + wind_mult)
        
        dIa = (i_ren_scale * math.sin(omega_base * t - 0.2)) + i_h5_amp * math.sin(omega_5 * t) + (v_trans * 0.8)
        dIb = (i_ren_scale * math.sin(omega_base * t - 2.0 * math.pi / 3.0 - 0.2)) + i_h5_amp * math.sin(omega_5 * t + 2.0 * math.pi / 3.0) - (v_trans * 0.4)
        dIc = (i_ren_scale * math.sin(omega_base * t + 2.0 * math.pi / 3.0 - 0.2)) + i_h5_amp * math.sin(omega_5 * t - 2.0 * math.pi / 3.0) - (v_trans * 0.4)
        
        telemetry = {
            "solar_enabled": self.solar_enabled,
            "wind_enabled": self.wind_enabled,
            "solar_penetration_pct": round(self.solar_penetration * 100.0, 1),
            "wind_penetration_pct": round(self.wind_penetration * 100.0, 1),
            "solar_mw": round(solar_mw, 1),
            "wind_mw": round(wind_mw, 1),
            "total_renewable_mw": round(total_renewable_mw, 1),
            "renewable_penetration_pct": round(renewable_pct, 1),
            "solar_irradiance_wm2": round(self.solar_irradiance, 1),
            "wind_speed_ms": round(self.wind_speed, 2),
            "inverter_switching_khz": round(self.inverter_switching_freq / 1000.0, 2),
            "inverter_transient_active": self.inverter_transient_active
        }
        
        return (dVa, dVb, dVc), (dIa, dIb, dIc), telemetry

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns snapshot telemetry of the renewable subsystem."""
        solar_mw = (
            self.solar_base_mw * self.solar_penetration * (self.solar_irradiance / 1000.0)
            if self.solar_enabled else 0.0
        )
        wind_fraction = min(1.0, (self.wind_speed / 12.0) ** 3)
        wind_mw = (
            self.wind_base_mw * self.wind_penetration * wind_fraction
            if self.wind_enabled else 0.0
        )
        total_mw = solar_mw + wind_mw
        return {
            "solar_enabled": self.solar_enabled,
            "wind_enabled": self.wind_enabled,
            "solar_penetration_pct": round(self.solar_penetration * 100.0, 1),
            "wind_penetration_pct": round(self.wind_penetration * 100.0, 1),
            "solar_mw": round(solar_mw, 1),
            "wind_mw": round(wind_mw, 1),
            "total_renewable_mw": round(total_mw, 1),
            "renewable_penetration_pct": round((total_mw / self.feeder_nominal_mw) * 100.0, 1),
            "solar_irradiance_wm2": round(self.solar_irradiance, 1),
            "wind_speed_ms": round(self.wind_speed, 2),
            "inverter_switching_khz": round(self.inverter_switching_freq / 1000.0, 2),
            "inverter_transient_active": self.inverter_transient_active
        }


# Singleton instance
renewable_service = RenewableGenerationService()

