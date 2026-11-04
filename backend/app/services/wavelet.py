import numpy as np
import pywt
from typing import Dict, List, Tuple, Any

WAVELET_FAMILY = "db4"
DECOMPOSITION_LEVEL = 3

CHANNELS = ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]

def compute_dwt_coefficients(signal: np.ndarray, wavelet: str = WAVELET_FAMILY, level: int = DECOMPOSITION_LEVEL):
    """
    Computes Discrete Wavelet Transform coefficients for a given 1D signal.
    Returns: [cA_n, cD_n, cD_(n-1), ..., cD_1]
    """
    max_lvl = pywt.dwt_max_level(len(signal), wavelet)
    actual_level = min(level, max_lvl)
    coeffs = pywt.wavedec(signal, wavelet=wavelet, level=actual_level, mode="symmetric")
    return coeffs

def calculate_wavelet_energy(coeffs_channel: List[np.ndarray]) -> Dict[str, float]:
    """
    Calculates energy spectral values for approximation and detail coefficients:
    Energy E_k = sum(c_k^2) / N_k
    """
    cA = coeffs_channel[0]
    details = coeffs_channel[1:]  # cD4, cD3, cD2, cD1 (from lowest to highest detail)
    
    energies = {}
    energies["approx_energy"] = float(np.sum(np.square(cA)))
    
    total_detail_energy = 0.0
    for idx, d in enumerate(details):
        level_num = len(details) - idx  # 4, 3, 2, 1
        d_energy = float(np.sum(np.square(d)))
        energies[f"detail_d{level_num}_energy"] = d_energy
        total_detail_energy += d_energy
        
    energies["total_detail_energy"] = total_detail_energy
    return energies

def calculate_wavelet_entropy(details: List[np.ndarray]) -> float:
    """
    Calculates normalized Shannon wavelet entropy of detail levels.
    """
    energies = [np.sum(np.square(d)) for d in details]
    total_energy = sum(energies)
    if total_energy <= 1e-12:
        return 0.0
    
    probabilities = [e / total_energy for e in energies if e > 0]
    entropy = -sum(p * np.log2(p + 1e-12) for p in probabilities)
    return float(entropy)

def extract_channel_features(signal: np.ndarray, channel_name: str) -> Dict[str, float]:
    """
    Extracts DWT energy, standard deviations, and time-domain metrics for a single channel.
    """
    feats = {}
    
    # 1. Time-domain statistics
    rms = float(np.sqrt(np.mean(np.square(signal))))
    peak = float(np.max(np.abs(signal)))
    p2p = float(np.ptp(signal))
    std = float(np.std(signal))
    
    feats[f"{channel_name}_rms"] = rms
    feats[f"{channel_name}_peak"] = peak
    feats[f"{channel_name}_p2p"] = p2p
    feats[f"{channel_name}_std"] = std
    
    # 2. DWT Daubechies 4 Decomposition
    coeffs = compute_dwt_coefficients(signal)
    cA = coeffs[0]
    details = coeffs[1:]  # cD4, cD3, cD2, cD1
    
    # Detail energies & standard deviations
    detail_energies = []
    for idx, d in enumerate(details):
        lvl = len(details) - idx  # 4, 3, 2, 1
        d_eng = float(np.sum(np.square(d)))
        d_std = float(np.std(d))
        feats[f"{channel_name}_d{lvl}_energy"] = d_eng
        feats[f"{channel_name}_d{lvl}_std"] = d_std
        detail_energies.append(d_eng)
        
    feats[f"{channel_name}_a4_energy"] = float(np.sum(np.square(cA)))
    feats[f"{channel_name}_total_d_energy"] = float(sum(detail_energies))
    feats[f"{channel_name}_wavelet_entropy"] = calculate_wavelet_entropy(details)
    
    return feats

def extract_features_from_window(window: Dict[str, np.ndarray]) -> np.ndarray:
    """
    Extracts complete engineered multi-channel feature vector from a time window:
    Includes all 6 phase channels plus zero-sequence (neutral) and differential currents.
    """
    feature_dict = {}
    
    # Extract for individual phase channels
    for ch in CHANNELS:
        ch_sig = np.asarray(window[ch], dtype=np.float64)
        ch_feats = extract_channel_features(ch_sig, ch)
        feature_dict.update(ch_feats)
        
    # Symmetrical / Sequence components
    # Zero sequence current I0 = (Ia + Ib + Ic) / 3 (Earth residual indicator)
    Ia = np.asarray(window["Ia"], dtype=np.float64)
    Ib = np.asarray(window["Ib"], dtype=np.float64)
    Ic = np.asarray(window["Ic"], dtype=np.float64)
    
    I_residual = Ia + Ib + Ic
    feature_dict.update(extract_channel_features(I_residual, "I_residual"))
    
    # Differential line-to-line currents
    I_ab = Ia - Ib
    I_bc = Ib - Ic
    I_ca = Ic - Ia
    
    feature_dict["I_ab_rms"] = float(np.sqrt(np.mean(np.square(I_ab))))
    feature_dict["I_bc_rms"] = float(np.sqrt(np.mean(np.square(I_bc))))
    feature_dict["I_ca_rms"] = float(np.sqrt(np.mean(np.square(I_ca))))
    
    # Differential voltages
    Va = np.asarray(window["Va"], dtype=np.float64)
    Vb = np.asarray(window["Vb"], dtype=np.float64)
    Vc = np.asarray(window["Vc"], dtype=np.float64)
    
    V_ab = Va - Vb
    V_bc = Vb - Vc
    V_ca = Vc - Va
    
    feature_dict["V_ab_rms"] = float(np.sqrt(np.mean(np.square(V_ab))))
    feature_dict["V_bc_rms"] = float(np.sqrt(np.mean(np.square(V_bc))))
    feature_dict["V_ca_rms"] = float(np.sqrt(np.mean(np.square(V_ca))))
    
    # Total Apparent Active / Power proxy
    feature_dict["P_proxy"] = float(np.mean(Va * Ia + Vb * Ib + Vc * Ic))
    
    # Sorted features for deterministic vector
    sorted_keys = sorted(feature_dict.keys())
    vector = np.array([feature_dict[k] for k in sorted_keys], dtype=np.float64)
    return vector

def get_feature_names() -> List[str]:
    """Generates the deterministic ordered list of feature names."""
    # Run a dummy extract to acquire exact keys
    dummy_len = 64
    dummy_window = {ch: np.zeros(dummy_len) for ch in CHANNELS}
    for ch in CHANNELS:
        dummy_window[ch][0] = 1.0  # Avoid zero division
    
    # Populate dummy
    dummy_dict = {}
    for ch in CHANNELS:
        dummy_dict.update(extract_channel_features(dummy_window[ch], ch))
        
    Ia = dummy_window["Ia"]
    Ib = dummy_window["Ib"]
    Ic = dummy_window["Ic"]
    Va = dummy_window["Va"]
    Vb = dummy_window["Vb"]
    Vc = dummy_window["Vc"]
    
    dummy_dict.update(extract_channel_features(Ia + Ib + Ic, "I_residual"))
    dummy_dict["I_ab_rms"] = 0.0
    dummy_dict["I_bc_rms"] = 0.0
    dummy_dict["I_ca_rms"] = 0.0
    dummy_dict["V_ab_rms"] = 0.0
    dummy_dict["V_bc_rms"] = 0.0
    dummy_dict["V_ca_rms"] = 0.0
    dummy_dict["P_proxy"] = 0.0
    
    return sorted(dummy_dict.keys())

def get_live_wavelet_spectrum(window: Dict[str, np.ndarray]) -> Dict[str, Any]:
    """
    Returns transient spectral energy breakdown specifically for the frontend SCADA display.
    """
    spectrum = {}
    for ch in ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]:
        sig = np.asarray(window[ch], dtype=np.float64)
        coeffs = compute_dwt_coefficients(sig)
        cA = coeffs[0]
        details = coeffs[1:]  # detail levels
        
        d_energies = [float(np.sum(np.square(d))) for d in details]
        # Pad or slice to 4 bands for SCADA UI display
        while len(d_energies) < 4:
            d_energies.append(0.0)
            
        spectrum[ch] = {
            "d1_high_freq": d_energies[-1] if len(d_energies) >= 1 else 0.0,
            "d2_mid_high": d_energies[-2] if len(d_energies) >= 2 else 0.0,
            "d3_mid_low": d_energies[-3] if len(d_energies) >= 3 else 0.0,
            "d4_low_transient": d_energies[0] if len(d_energies) >= 4 else 0.0,
            "a_fundamental": float(np.sum(np.square(cA))),
            "entropy": calculate_wavelet_entropy(details)
        }
    return spectrum
