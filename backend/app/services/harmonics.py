"""
Power Quality & Harmonic (THD) Calculator Module
Implements real-time Fast Fourier Transform (FFT) analysis to compute
Total Harmonic Distortion (THD %) for 3-phase voltages and currents
in accordance with IEEE 519-2022 power quality standards.
"""

import math
from typing import Dict, Any, List
import numpy as np


class PowerQualityHarmonicsCalculator:
    """
    Computes real-time spectral FFT, THD %, individual harmonic orders (3rd, 5th, 7th, 9th, 11th),
    crest factor, and IEEE 519 compliance status.
    """
    def __init__(self, fs: float = 2000.0, nominal_freq: float = 50.0):
        self.fs = fs
        self.nominal_freq = nominal_freq

    def compute_channel_thd(self, signal: np.ndarray) -> Dict[str, Any]:
        """
        Computes THD, RMS, Crest Factor, and individual harmonics for a single signal channel.
        Uses exact integer cycle slicing or Hanning windowing to prevent spectral leakage.
        """
        if len(signal) < 32:
            return {
                "thd_pct": 0.0,
                "rms": 1.0,
                "crest_factor": 1.414,
                "fundamental_mag": 1.0,
                "harmonics": {"h3": 0.0, "h5": 0.0, "h7": 0.0, "h9": 0.0, "h11": 0.0}
            }

        # Select window length for optimal 50Hz integer cycles (at 2000Hz, 40 samples = 1 cycle, 80 samples = 2 cycles)
        target_len = 80 if len(signal) >= 80 else (40 if len(signal) >= 40 else len(signal))
        data = signal[-target_len:].astype(float)
        N = len(data)

        # Apply Hanning window if not an exact multiple of 40 to minimize leakage
        if N % 40 != 0:
            window = np.hanning(N)
            windowed_data = data * window
            # Window correction factor for coherent gain
            scale_factor = 2.0 / np.sum(window)
        else:
            windowed_data = data
            scale_factor = 2.0 / N

        # Real FFT
        fft_vals = np.fft.rfft(windowed_data)
        freqs = np.fft.rfftfreq(N, d=1.0 / self.fs)
        mags = np.abs(fft_vals) * (scale_factor if N % 40 != 0 else (2.0 / N))

        # Identify fundamental bin (closest to 50 Hz)
        fund_idx = int(np.argmin(np.abs(freqs - self.nominal_freq)))
        v1 = mags[fund_idx] if fund_idx < len(mags) else 1e-4
        if v1 < 1e-4:
            v1 = 1e-4

        # Extract harmonic orders
        harmonic_orders = [3, 5, 7, 9, 11]
        harmonics_dict = {}
        harmonic_powers = []

        for h in harmonic_orders:
            target_h_freq = h * self.nominal_freq
            h_idx = int(np.argmin(np.abs(freqs - target_h_freq)))
            if h_idx < len(mags) and h_idx != fund_idx:
                h_mag = mags[h_idx]
                harmonics_dict[f"h{h}"] = round(float((h_mag / v1) * 100.0), 2)
                harmonic_powers.append(h_mag ** 2)
            else:
                harmonics_dict[f"h{h}"] = 0.0

        # Full harmonic spectrum sum (from 2nd harmonic up to Nyquist)
        # Exclude DC (bin 0) and fundamental
        all_harm_sq = []
        for i in range(1, len(mags)):
            if abs(freqs[i] - self.nominal_freq) > (self.nominal_freq * 0.4):
                all_harm_sq.append(mags[i] ** 2)

        harm_sum_sqrt = math.sqrt(sum(all_harm_sq)) if all_harm_sq else 0.0
        thd_pct = (harm_sum_sqrt / v1) * 100.0

        # Physical signal properties
        rms = float(np.sqrt(np.mean(data ** 2)))
        peak = float(np.max(np.abs(data)))
        crest_factor = round(peak / (rms + 1e-6), 2)

        return {
            "thd_pct": round(min(99.9, thd_pct), 2),
            "rms": round(rms, 4),
            "crest_factor": crest_factor,
            "fundamental_mag": round(float(v1), 4),
            "harmonics": harmonics_dict
        }

    def compute_all_channels(self, window: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """
        Computes THD & power quality analysis for all 6 transmission channels (Va, Vb, Vc, Ia, Ib, Ic).
        """
        res_va = self.compute_channel_thd(window.get("Va", np.array([])))
        res_vb = self.compute_channel_thd(window.get("Vb", np.array([])))
        res_vc = self.compute_channel_thd(window.get("Vc", np.array([])))
        res_ia = self.compute_channel_thd(window.get("Ia", np.array([])))
        res_ib = self.compute_channel_thd(window.get("Ib", np.array([])))
        res_ic = self.compute_channel_thd(window.get("Ic", np.array([])))

        v_thd_avg = round((res_va["thd_pct"] + res_vb["thd_pct"] + res_vc["thd_pct"]) / 3.0, 2)
        i_thd_avg = round((res_ia["thd_pct"] + res_ib["thd_pct"] + res_ic["thd_pct"]) / 3.0, 2)

        # IEEE 519-2022 Transmission Voltage THD Limit is 5.0%
        # Individual harmonic voltage distortion limit is 3.0%
        max_v_harm = max(
            res_va["harmonics"]["h3"], res_va["harmonics"]["h5"], res_va["harmonics"]["h7"],
            res_vb["harmonics"]["h3"], res_vb["harmonics"]["h5"], res_vb["harmonics"]["h7"],
            res_vc["harmonics"]["h3"], res_vc["harmonics"]["h5"], res_vc["harmonics"]["h7"]
        )
        
        is_compliant = (v_thd_avg <= 5.0 and max_v_harm <= 3.0)
        status_text = "COMPLIANT (IEEE 519)" if is_compliant else "VIOLATION (HIGH HARMONICS)"

        return {
            "v_thd_avg": v_thd_avg,
            "i_thd_avg": i_thd_avg,
            "ieee_519_compliant": is_compliant,
            "ieee_519_status": status_text,
            "max_v_harmonic_pct": round(max_v_harm, 2),
            "channels": {
                "Va": res_va,
                "Vb": res_vb,
                "Vc": res_vc,
                "Ia": res_ia,
                "Ib": res_ib,
                "Ic": res_ic
            },
            # Primary phase A harmonic spectrum for display
            "harmonic_spectrum": [
                {"harmonic": "3rd (150Hz)", "pct": res_va["harmonics"]["h3"], "limit": 3.0},
                {"harmonic": "5th (250Hz)", "pct": res_va["harmonics"]["h5"], "limit": 3.0},
                {"harmonic": "7th (350Hz)", "pct": res_va["harmonics"]["h7"], "limit": 3.0},
                {"harmonic": "9th (450Hz)", "pct": res_va["harmonics"]["h9"], "limit": 1.5},
                {"harmonic": "11th (550Hz)", "pct": res_va["harmonics"]["h11"], "limit": 1.5}
            ]
        }


# Singleton instance
harmonics_calculator = PowerQualityHarmonicsCalculator()

