"""
Direct integration test for AI-FaultClassifier backend.
Tests services directly without HTTP/WebSocket overhead.
"""
import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["GRID_TELEMETRY_OFFLINE"] = "1"

def test_wavelet_service():
    """Test DWT feature extraction with db4 wavelet."""
    import numpy as np
    from app.services.wavelet import extract_features_from_window, get_live_wavelet_spectrum, WAVELET_FAMILY

    print(f"  Wavelet family: {WAVELET_FAMILY}")
    t = np.linspace(0, 0.032, 64)
    omega = 2.0 * 3.14159 * 50.0
    window = {
        "Va": np.sin(omega * t),
        "Vb": np.sin(omega * t - 2.094),
        "Vc": np.sin(omega * t + 2.094),
        "Ia": 0.9 * np.sin(omega * t - 0.4),
        "Ib": 0.9 * np.sin(omega * t - 2.094 - 0.4),
        "Ic": 0.9 * np.sin(omega * t + 2.094 - 0.4),
    }
    feats = extract_features_from_window(window)
    assert feats is not None and len(feats) > 0, "Feature vector is empty!"
    print(f"  Feature vector: {len(feats)} features extracted OK")
    
    spec = get_live_wavelet_spectrum(window)
    assert "Va" in spec and "d1_high_freq" in spec["Va"]
    print(f"  Wavelet spectrum (Va D1 energy): {spec['Va']['d1_high_freq']:.6f}")
    print("  PASS: DWT db4 Wavelet Service")

def test_fault_generator():
    """Test synthetic 3-phase fault waveform generation for all 11 classes."""
    from app.data.generate_fault_data import PowerGridFaultSimulator
    
    sim = PowerGridFaultSimulator()
    
    FAULT_NAMES = {
        0: "Normal", 1: "LG-AG", 2: "LG-BG", 3: "LG-CG",
        4: "LL-AB", 5: "LL-BC", 6: "LL-CA",
        7: "LLG-ABG", 8: "LLG-BCG", 9: "LLG-CAG",
        10: "LLL-ABC"
    }
    
    for cls_id in range(11):
        wf = sim.generate_waveform(
            fault_class=cls_id,
            duration_sec=0.06,
            fault_start_time=0.02,
            distance_km=40.0,
            fault_resistance=2.0,
            inception_angle_deg=45.0,
            noise_level_db=38.0
        )
        assert "Va" in wf and "Ia" in wf
        assert len(wf["Va"]) > 0
        assert wf["fault_class"] == cls_id
        print(f"  Class {cls_id:2d} [{FAULT_NAMES[cls_id]:10s}]: {len(wf['Va'])} samples generated. Va_max={max(abs(wf['Va'])):.3f} pu")
    
    print("  PASS: 11-Class Fault Waveform Generator")

def test_classifier_service():
    """Test pre-trained Random Forest classifier."""
    import numpy as np
    from app.services.classifier import classifier_service
    from app.services.wavelet import extract_features_from_window
    
    classifier_service.load_or_train()
    assert classifier_service.is_trained(), "Model must be trained/loaded"
    
    acc = classifier_service.metrics.get("accuracy_percent", 0)
    feat_count = classifier_service.metrics.get("feature_count", 0)
    print(f"  Model accuracy: {acc}% | Feature dimensions: {feat_count}")
    assert acc >= 98.0, f"Accuracy {acc}% is below 98% threshold!"
    
    # Test normal classification
    t = [i / 2000.0 for i in range(64)]
    omega = 2.0 * 3.14159 * 50.0
    import math
    window_normal = {
        "Va": [math.sin(omega * ti) for ti in t],
        "Vb": [math.sin(omega * ti - 2.094) for ti in t],
        "Vc": [math.sin(omega * ti + 2.094) for ti in t],
        "Ia": [0.85 * math.sin(omega * ti - 0.4) for ti in t],
        "Ib": [0.85 * math.sin(omega * ti - 2.094 - 0.4) for ti in t],
        "Ic": [0.85 * math.sin(omega * ti + 2.094 - 0.4) for ti in t],
    }
    window_n = {k: __import__('numpy').array(v) for k, v in window_normal.items()}
    result_normal = classifier_service.classify_window(window_n)
    print(f"  Normal state: Class={result_normal['class_id']} ({result_normal['code']}), confidence={result_normal['confidence_percent']}%, trip={result_normal['trip_signal']}")
    assert result_normal["class_id"] == 0, f"Expected class 0, got {result_normal['class_id']}"
    
    print("  PASS: AI Random Forest Classifier Service")

def test_grid_engine():
    """Test real-time waveform simulation engine with fault injection."""
    from app.services.simulator import GridWaveformEngine
    
    engine = GridWaveformEngine()
    
    # Normal state
    frame = engine.step(num_samples=16)
    assert frame["type"] == "TELEMETRY_FRAME"
    assert len(frame["points"]) == 16
    assert "classification" in frame
    assert "wavelet_spectrum" in frame
    assert "trip_status" in frame
    print(f"  Normal frame: {len(frame['points'])} pts | class={frame['classification']['code']} | trip={frame['trip_status']['relay_tripped']}")
    
    # Inject Class 7 (LLG-ABG) fault
    engine.inject_fault(fault_class=7, distance_km=28.0, resistance_ohm=1.2, duration_ms=500.0)
    
    # Step through fault
    for _ in range(8):
        fault_frame = engine.step(num_samples=16)
    
    print(f"  Fault frame: class={fault_frame['classification']['code']} | trip={fault_frame['trip_status']['relay_tripped']} | dist={fault_frame['classification']['estimated_distance_km']}km")
    
    # Reset relay
    engine.reset_relay()
    clean_frame = engine.step(num_samples=8)
    assert not clean_frame["trip_status"]["relay_tripped"]
    print(f"  Post-reset: trip={clean_frame['trip_status']['relay_tripped']} | breaker={clean_frame['trip_status']['breaker_state']}")
    
    print("  PASS: Real-Time Grid Waveform Simulation Engine")

def test_grid_telemetry():
    """Test live grid telemetry (stochastic fallback mode)."""
    from app.services.live_grid_api import LiveGridTelemetryService
    
    svc = LiveGridTelemetryService()
    svc._stochastic_tick()  # Simulate a tick
    status = svc.get_status()
    
    assert "grid_frequency_hz" in status
    assert "carbon_intensity_gco2_kwh" in status
    assert "grid_stress_level" in status
    assert "generation_mix" in status
    
    freq = status["grid_frequency_hz"]
    assert 49.9 <= freq <= 50.1, f"Frequency {freq} out of normal range!"
    print(f"  Grid status: freq={freq}Hz | stress={status['grid_stress_level']} | source={status['source']}")
    print("  PASS: Live Grid Telemetry Service (Stochastic Mode)")

def test_model_metrics():
    """Verify saved model metadata."""
    from app.config import METRICS_PATH
    
    with open(METRICS_PATH, "r") as f:
        metrics = json.load(f)
    
    acc = metrics["accuracy"]
    assert acc >= 0.98, f"Saved accuracy {acc:.4f} must be >= 98%"
    assert metrics["classes_count"] == 11
    assert metrics["feature_count"] > 50
    
    print(f"  Saved metrics: acc={metrics['accuracy_percent']}% | features={metrics['feature_count']} | classes={metrics['classes_count']}")
    print(f"  Top 3 features: {[f['feature'] for f in metrics['top_features'][:3]]}")
    print("  PASS: Model Metrics Validation")

def test_renewable_service():
    """Module 1: Test Renewable Generation (Solar PV + Wind) integration."""
    from app.services.renewable import renewable_service
    
    # Configure high penetration
    cfg = renewable_service.configure(
        solar_enabled=True,
        wind_enabled=True,
        solar_penetration=0.35,
        wind_penetration=0.35
    )
    assert cfg["solar_enabled"] and cfg["wind_enabled"]
    assert cfg["solar_penetration_pct"] == 35.0
    
    # Trigger inverter transient
    renewable_service.trigger_inverter_transient(duration_s=0.2)
    assert renewable_service.inverter_transient_active
    
    # Compute perturbations
    (dVa, dVb, dVc), (dIa, dIb, dIc), tel = renewable_service.compute_injection(t=0.05, dt=0.0005)
    assert abs(dVa) < 0.25, "Renewable voltage perturbation must remain within transmission limits"
    assert "total_renewable_mw" in tel and tel["total_renewable_mw"] > 0
    print(f"  Renewable Generation: Solar={tel['solar_mw']}MW | Wind={tel['wind_mw']}MW | Total={tel['total_renewable_mw']}MW ({tel['renewable_penetration_pct']}%)")
    print(f"  Inverter Harmonics: f_sw={tel['inverter_switching_khz']}kHz | Transient={tel['inverter_transient_active']}")
    print("  PASS: Renewable Generation (Solar + Wind) Service")

def test_harmonics_calculator():
    """Module 2: Test Power Quality & FFT Harmonic (THD) Calculator."""
    import numpy as np
    from app.services.harmonics import harmonics_calculator
    
    t = np.linspace(0, 0.04, 80) # 2 cycles of 50 Hz at 2000 Hz
    omega = 2.0 * np.pi * 50.0
    
    # Pure sine wave + 2% 5th harmonic + 1.5% 7th harmonic
    v_clean = np.sin(omega * t) + 0.02 * np.sin(5.0 * omega * t) + 0.015 * np.sin(7.0 * omega * t)
    window = {
        "Va": v_clean,
        "Vb": np.sin(omega * t - 2.094),
        "Vc": np.sin(omega * t + 2.094),
        "Ia": np.sin(omega * t - 0.4) + 0.03 * np.sin(5.0 * omega * t),
        "Ib": np.sin(omega * t - 2.094 - 0.4),
        "Ic": np.sin(omega * t + 2.094 - 0.4),
    }
    
    res = harmonics_calculator.compute_all_channels(window)
    assert "v_thd_avg" in res and "i_thd_avg" in res
    assert "harmonic_spectrum" in res
    assert res["v_thd_avg"] > 0.5, "THD must detect injected 5th & 7th harmonics"
    assert res["ieee_519_compliant"], "2% THD must be IEEE 519 compliant (<5%)"
    
    print(f"  Power Quality: V_THD={res['v_thd_avg']}% | I_THD={res['i_thd_avg']}% | Status={res['ieee_519_status']}")
    print(f"  Harmonics: 3rd={res['channels']['Va']['harmonics']['h3']}% | 5th={res['channels']['Va']['harmonics']['h5']}% | 7th={res['channels']['Va']['harmonics']['h7']}%")
    print("  PASS: Power Quality & Harmonic FFT (THD) Calculator")

def test_report_generator():
    """Module 3: Test Automated Analytical Fault Report Generator."""
    from app.services.report_generator import report_generator
    
    dummy_trip = {
        "relay_tripped": True,
        "breaker_state": "TRIPPED",
        "trip_latency_ms": 14.2,
        "trip_timestamp": "2026-11-03T12:00:00Z",
        "trip_details": {
            "fault_class": 1,
            "fault_name": "LINE-TO-GROUND (Phase A-G)",
            "category": "Asymmetrical Fault",
            "ansi_code": "ANSI 21/50G Phase A-G",
            "distance_km": 38.5,
            "protection_zone": "Zone 1",
            "impedance_ohm": 1.95,
            "trip_latency_ms": 14.2,
            "trip_time": "2026-11-03T12:00:00Z"
        }
    }
    
    report_dict = report_generator.generate_report_dict(trip_status=dummy_trip)
    assert "report_id" in report_dict
    assert report_dict["trip_summary"]["ansi_code"] == "ANSI 21/50G Phase A-G"
    assert len(report_dict["sequence_of_events"]) >= 6
    
    html = report_generator.generate_html_report(report_dict)
    assert "<!DOCTYPE html>" in html
    assert "ANALYTICAL FAULT TRIP REPORT" in html
    assert "SEL-421" in html
    print(f"  Report generated: ID={report_dict['report_id']} | SOE Events={len(report_dict['sequence_of_events'])} | HTML bytes={len(html)}")
    print("  PASS: Automated Fault Report Generator (JSON & HTML)")

def test_classifier_robustness_with_renewables():
    """Verify DWT + Random Forest classifier retains >98% accuracy during heavy renewable fluctuation."""
    import numpy as np
    from app.services.classifier import classifier_service
    from app.services.renewable import renewable_service
    from app.data.generate_fault_data import PowerGridFaultSimulator
    
    # Configure heavy renewable penetration & transient
    renewable_service.configure(solar_enabled=True, wind_enabled=True, solar_penetration=0.50, wind_penetration=0.50)
    renewable_service.trigger_inverter_transient(duration_s=1.0)
    
    sim = PowerGridFaultSimulator()
    correct = 0
    total = 0
    
    for cls_id in range(11):
        wf = sim.generate_waveform(
            fault_class=cls_id,
            duration_sec=0.064,
            fault_start_time=0.016,
            distance_km=40.0,
            fault_resistance=2.0
        )
        
        # Add renewable inverter harmonics and switching ripple to the waveform
        t_arr = np.linspace(0, 0.064, len(wf["Va"]))
        for idx, t_val in enumerate(t_arr):
            (dVa, dVb, dVc), (dIa, dIb, dIc), _ = renewable_service.compute_injection(t_val, 0.0005)
            wf["Va"][idx] += dVa
            wf["Vb"][idx] += dVb
            wf["Vc"][idx] += dVc
            wf["Ia"][idx] += dIa
            wf["Ib"][idx] += dIb
            wf["Ic"][idx] += dIc
            
        # Classify transient window (samples 40 to 104)
        window = {
            k: np.array(wf[k][40:104]) for k in ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"]
        }
        res = classifier_service.classify_window(window)
        total += 1
        if res["class_id"] == cls_id:
            correct += 1
            
    accuracy = (correct / total) * 100.0
    print(f"  Classifier Accuracy under 50% Solar + 50% Wind + Inverter Transient: {accuracy:.1f}% ({correct}/{total} classes)")
    assert accuracy >= 98.0, f"Accuracy under renewable modulation ({accuracy}%) dropped below 98%!"
    print("  PASS: Classifier Robustness Verification with Heavy Renewable Fluctuation")

def main():
    print("=" * 65)
    print("AI-FAULTCLASSIFIER BACKEND INTEGRATION TEST SUITE")
    print("SCADA Digital Protection Relay | DWT db4 | Random Forest")
    print("=" * 65)
    
    tests = [
        ("DWT PyWavelets Feature Extraction",           test_wavelet_service),
        ("11-Class Fault Waveform Generator",           test_fault_generator),
        ("AI Classifier (Random Forest >98%)",          test_classifier_service),
        ("Real-Time Grid Simulation Engine",            test_grid_engine),
        ("Live Grid Telemetry Service",                 test_grid_telemetry),
        ("Saved Model Metrics Validation",              test_model_metrics),
        ("Renewable Generation Integration (Solar/Wind)", test_renewable_service),
        ("Power Quality & Harmonic (THD) Calculator",   test_harmonics_calculator),
        ("Automated Fault Report Generator",            test_report_generator),
        ("Classifier Robustness with Renewables",        test_classifier_robustness_with_renewables),
    ]
    
    passed = 0
    failed = 0
    
    for name, fn in tests:
        print(f"\n[TEST] {name}")
        try:
            fn()
            passed += 1
        except Exception as e:
            print(f"  FAIL: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 65)
    print(f"RESULTS: {passed}/{len(tests)} tests PASSED | {failed} FAILED")
    print("=" * 65)
    
    if failed == 0:
        print(">>> ALL BACKEND TESTS PASSED CLEANLY! SYSTEM IS READY. <<<")
        return 0
    else:
        print(">>> SOME TESTS FAILED - SEE ABOVE FOR DETAILS <<<")
        return 1

if __name__ == "__main__":
    sys.exit(main())
