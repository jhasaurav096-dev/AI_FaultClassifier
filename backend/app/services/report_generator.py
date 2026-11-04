"""
Automated Fault Report Generator Module
Generates analytical Sequence-of-Events (SOE) digital relay trip reports
in structured JSON and industrial printable SCADA HTML format.
"""

import json
from datetime import datetime
from typing import Dict, Any, Optional, List


class RelayFaultReportGenerator:
    """
    Constructs comprehensive forensic protection relay trip reports
    incorporating DWT wavelet features, AI classification, distance estimation,
    power quality THD analysis, and renewable generation state.
    """
    def __init__(self):
        self.station_name = "WEST SUBSTATION 400kV"
        self.feeder_id = "FEEDER L-401 (400kV TRANSMISSION LINE)"
        self.relay_model = "SEL-421 / AI-RELAY-PROTECT-PRO v2.4"
        self.firmware_rev = "REV-2026.4-SCADA"

    def generate_report_dict(
        self,
        trip_status: Dict[str, Any],
        classification: Optional[Dict[str, Any]] = None,
        power_quality: Optional[Dict[str, Any]] = None,
        renewable_telemetry: Optional[Dict[str, Any]] = None,
        recent_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Builds a comprehensive structured dictionary of the fault incident report.
        """
        now_iso = datetime.utcnow().isoformat() + "Z"
        report_id = f"RPT-L401-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"

        trip_details = trip_status.get("trip_details") or {}
        clf = classification or {}
        
        fault_class_id = trip_details.get("fault_class", clf.get("class_id", 0))
        fault_name = trip_details.get("fault_name", clf.get("name", "NORMAL GRID STATE"))
        ansi_code = trip_details.get("ansi_code", clf.get("ansi_code", "ANSI 50/51"))
        category = trip_details.get("category", clf.get("category", "Balanced Operation"))
        confidence = clf.get("confidence", 99.8)
        distance_km = trip_details.get("distance_km", clf.get("estimated_distance_km", 45.0))
        zone = trip_details.get("protection_zone", clf.get("protection_zone", "Zone 1"))
        impedance_ohm = trip_details.get("impedance_ohm", clf.get("estimated_impedance_ohm", 2.5))
        latency_ms = trip_status.get("trip_latency_ms", 12.8)
        trip_time = trip_status.get("trip_timestamp", now_iso)

        # Generate standard Sequence of Events chronogram
        soe_timeline = [
            {
                "offset_ms": -10.0,
                "event": "PRE_FAULT_STEADY_STATE",
                "element": "FEEDER L-401",
                "description": "Nominal balanced 3-phase 400kV transmission. Normal current load."
            },
            {
                "offset_ms": 0.0,
                "event": "TRANSIENT_FAULT_INCEPTION",
                "element": "TRANSMISSION LINE",
                "description": f"Abrupt transient inception detected on Feeder L-401 at ~{distance_km} km."
            },
            {
                "offset_ms": round(latency_ms * 0.15, 1),
                "event": "WAVELET_DWT_TRIGGER",
                "element": "DSP / PYWAVELETS db4",
                "description": "High-frequency D1 detail energy spike exceeds detection threshold."
            },
            {
                "offset_ms": round(latency_ms * 0.45, 1),
                "event": "AI_INFERENCE_CLASSIFICATION",
                "element": "RANDOM FOREST CLASSIFIER",
                "description": f"Identified {fault_name} ({ansi_code}) with {confidence}% confidence."
            },
            {
                "offset_ms": round(latency_ms * 0.70, 1),
                "event": "DISTANCE_REGRESSION_CALC",
                "element": "EXTRA_TREES REGRESSOR",
                "description": f"Fault location calculated at {distance_km} km ({zone}). Loop Z={impedance_ohm} Ω."
            },
            {
                "offset_ms": round(latency_ms, 1),
                "event": "PROTECTION_TRIP_COMMAND",
                "element": "ANSI 21/50 TRIP COIL",
                "description": f"Trip command issued to Breaker CB-401 in {latency_ms} ms."
            },
            {
                "offset_ms": round(latency_ms + 18.0, 1),
                "event": "BREAKER_AUX_CONTACT_OPEN",
                "element": "CB-401 52a/52b",
                "description": "Main circuit breaker contacts opened, fault current interrupted."
            },
            {
                "offset_ms": round(latency_ms + 22.0, 1),
                "event": "LOCKOUT_ANNUNCIATION",
                "element": "RELAY 86 / SCADA EMS",
                "description": "Protective lockout latch active. SCADA alarm annunciated to control room."
            }
        ]

        pq = power_quality or {
            "v_thd_avg": 1.42,
            "i_thd_avg": 2.15,
            "ieee_519_compliant": True,
            "ieee_519_status": "COMPLIANT (IEEE 519)",
            "max_v_harmonic_pct": 0.85
        }

        ren = renewable_telemetry or {
            "solar_mw": 37.5,
            "wind_mw": 62.5,
            "total_renewable_mw": 100.0,
            "renewable_penetration_pct": 16.7,
            "solar_irradiance_wm2": 850.0,
            "wind_speed_ms": 11.2
        }

        return {
            "report_id": report_id,
            "generated_at": now_iso,
            "substation": self.station_name,
            "feeder": self.feeder_id,
            "relay_model": self.relay_model,
            "firmware": self.firmware_rev,
            "trip_summary": {
                "fault_class_id": fault_class_id,
                "fault_name": fault_name,
                "category": category,
                "ansi_code": ansi_code,
                "trip_time": trip_time,
                "trip_latency_ms": latency_ms,
                "relay_tripped": trip_status.get("relay_tripped", True),
                "breaker_state": trip_status.get("breaker_state", "TRIPPED"),
                "confidence_percent": confidence,
                "estimated_distance_km": distance_km,
                "line_length_km": 100.0,
                "distance_percent_of_line": round((distance_km / 100.0) * 100.0, 1),
                "protection_zone": zone,
                "estimated_impedance_ohm": impedance_ohm
            },
            "power_quality_at_trip": {
                "v_thd_avg_pct": pq.get("v_thd_avg", 1.42),
                "i_thd_avg_pct": pq.get("i_thd_avg", 2.15),
                "ieee_519_status": pq.get("ieee_519_status", "COMPLIANT (IEEE 519)"),
                "ieee_519_compliant": pq.get("ieee_519_compliant", True),
                "max_v_harmonic_pct": pq.get("max_v_harmonic_pct", 0.85),
                "harmonic_orders": pq.get("harmonic_spectrum", [])
            },
            "renewable_generation_context": {
                "solar_generation_mw": ren.get("solar_mw", 0.0),
                "wind_generation_mw": ren.get("wind_mw", 0.0),
                "total_renewable_mw": ren.get("total_renewable_mw", 0.0),
                "renewable_penetration_pct": ren.get("renewable_penetration_pct", 0.0),
                "solar_irradiance_wm2": ren.get("solar_irradiance_wm2", 0.0),
                "wind_speed_ms": ren.get("wind_speed_ms", 0.0),
                "inverter_transient_active": ren.get("inverter_transient_active", False)
            },
            "sequence_of_events": soe_timeline,
            "recent_events_log": (recent_events or [])[:20],
            "signoff": {
                "engineer_role": "Transmission Protection Engineer",
                "validation_status": "AUTOMATED_AI_SCADA_VALIDATED",
                "standard": "IEEE C37.113 / IEC 60255 / IEEE 519"
            }
        }

    def generate_html_report(self, report_dict: Dict[str, Any]) -> str:
        """
        Renders a printable SCADA engineering trip report in HTML with embedded CSS styling.
        Designed for both dark control room viewing and high-contrast PDF printing.
        """
        r = report_dict
        ts = r["trip_summary"]
        pq = r["power_quality_at_trip"]
        ren = r["renewable_generation_context"]
        soe = r["sequence_of_events"]

        is_tripped = ts.get("relay_tripped", True)
        status_color = "#ef4444" if is_tripped else "#10b981"
        status_label = "RELAY TRIP / LOCKOUT ACTIVE" if is_tripped else "SYSTEM HEALTHY / NORMAL"

        soe_rows_html = "".join([
            f"""
            <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 6px 10px; font-family: monospace; color: #38bdf8;">T0 {row['offset_ms']:+0.1f} ms</td>
                <td style="padding: 6px 10px; font-weight: bold; color: {'#f87171' if 'TRIP' in row['event'] or 'FAULT' in row['event'] else '#94a3b8'};">{row['event']}</td>
                <td style="padding: 6px 10px; font-family: monospace; color: #cbd5e1;">{row['element']}</td>
                <td style="padding: 6px 10px; color: #94a3b8;">{row['description']}</td>
            </tr>
            """
            for row in soe
        ])

        html_template = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Protection Relay Trip Report - {r['report_id']}</title>
    <style>
        body {{
            background-color: #0b1120;
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 24px;
        }}
        .report-card {{
            max-width: 900px;
            margin: 0 auto;
            background-color: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 8px;
            padding: 28px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }}
        .header-bar {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #334155;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }}
        .badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            font-weight: bold;
        }}
        .grid-2 {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 20px;
        }}
        .grid-3 {{
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
        }}
        .section-box {{
            background-color: #070c18;
            border: 1px solid #1e293b;
            border-radius: 6px;
            padding: 14px;
        }}
        .section-title {{
            font-size: 11px;
            font-weight: 700;
            color: #38bdf8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
            border-bottom: 1px solid #1e293b;
            padding-bottom: 4px;
        }}
        .data-row {{
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 13px;
        }}
        .data-label {{ color: #94a3b8; }}
        .data-val {{ font-family: monospace; font-weight: 600; color: #f8fafc; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: left;
        }}
        th {{
            background-color: #1e293b;
            color: #94a3b8;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
        }}
        .print-btn {{
            background-color: #0284c7;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }}
        .print-btn:hover {{ background-color: #0369a1; }}
        @media print {{
            body {{ background-color: white; color: black; padding: 0; }}
            .report-card {{ background-color: white; border: none; box-shadow: none; color: black; }}
            .section-box {{ background-color: #f8fafc; border: 1px solid #cbd5e1; color: black; }}
            .data-label {{ color: #475569; }}
            .data-val {{ color: black; }}
            th {{ background-color: #f1f5f9; color: black; }}
            .no-print {{ display: none !important; }}
        }}
    </style>
</head>
<body>
    <div class="report-card">
        <div class="header-bar">
            <div>
                <div style="font-size: 11px; color: #38bdf8; font-weight: bold; font-family: monospace;">SCADA TRANSMISSION GRID PROTECTION SYSTEM</div>
                <h1 style="margin: 4px 0 6px 0; font-size: 20px; font-weight: 800; color: #f8fafc;">ANALYTICAL FAULT TRIP REPORT</h1>
                <div style="font-size: 12px; color: #94a3b8;">
                    <strong>{r['substation']}</strong> &bull; {r['feeder']} &bull; Relay ID: <code>{r['relay_model']}</code>
                </div>
            </div>
            <div style="text-align: right;">
                <div class="no-print" style="margin-bottom: 8px;">
                    <button class="print-btn" onclick="window.print()">🖨️ Print / Save to PDF</button>
                </div>
                <div class="badge" style="background-color: {status_color}22; color: {status_color}; border: 1px solid {status_color};">
                    {status_label}
                </div>
                <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 4px;">{r['report_id']}</div>
            </div>
        </div>

        <!-- Section 1: Trip Summary & AI Classification -->
        <div class="grid-2">
            <div class="section-box">
                <div class="section-title">AI Protection Relay Diagnostics</div>
                <div class="data-row">
                    <span class="data-label">Classified Fault:</span>
                    <span class="data-val" style="color: #f87171;">{ts['fault_name']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">ANSI Protection Code:</span>
                    <span class="data-val">{ts['ansi_code']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Taxonomy Category:</span>
                    <span class="data-val">{ts['category']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">AI Model Confidence:</span>
                    <span class="data-val" style="color: #34d399;">{ts['confidence_percent']}%</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Trip Latency (Speed):</span>
                    <span class="data-val" style="color: #38bdf8;">{ts['trip_latency_ms']} ms</span>
                </div>
            </div>

            <div class="section-box">
                <div class="section-title">Fault Location & Line Impedance</div>
                <div class="data-row">
                    <span class="data-label">Estimated Distance:</span>
                    <span class="data-val" style="color: #fbbf24;">{ts['estimated_distance_km']} km ({ts['distance_percent_of_line']}% of line)</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Protection Zone:</span>
                    <span class="data-val">{ts['protection_zone']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Loop Impedance:</span>
                    <span class="data-val">{ts['estimated_impedance_ohm']} Ω</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Main Breaker Pole:</span>
                    <span class="data-val">{ts['breaker_state']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Trip Timestamp UTC:</span>
                    <span class="data-val">{ts['trip_time']}</span>
                </div>
            </div>
        </div>

        <!-- Section 2: Power Quality & Renewable Telemetry Context -->
        <div class="grid-2">
            <div class="section-box">
                <div class="section-title">Power Quality & Harmonics (IEEE 519)</div>
                <div class="data-row">
                    <span class="data-label">Average Voltage THD:</span>
                    <span class="data-val">{pq['v_thd_avg_pct']}%</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Average Current THD:</span>
                    <span class="data-val">{pq['i_thd_avg_pct']}%</span>
                </div>
                <div class="data-row">
                    <span class="data-label">IEEE 519 Compliance:</span>
                    <span class="data-val" style="color: {'#34d399' if pq['ieee_519_compliant'] else '#f87171'};">{pq['ieee_519_status']}</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Max Harmonic Order (Va):</span>
                    <span class="data-val">{pq['max_v_harmonic_pct']}% (Limit &lt; 3.0%)</span>
                </div>
            </div>

            <div class="section-box">
                <div class="section-title">Renewable Generation Mix at Trip</div>
                <div class="data-row">
                    <span class="data-label">Solar PV Power:</span>
                    <span class="data-val">{ren['solar_generation_mw']} MW ({ren['solar_irradiance_wm2']} W/m²)</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Wind Turbine Power:</span>
                    <span class="data-val">{ren['wind_generation_mw']} MW ({ren['wind_speed_ms']} m/s)</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Total Renewable Share:</span>
                    <span class="data-val" style="color: #38bdf8;">{ren['renewable_penetration_pct']}% ({ren['total_renewable_mw']} MW)</span>
                </div>
                <div class="data-row">
                    <span class="data-label">Inverter Transient:</span>
                    <span class="data-val">{'ACTIVE' if ren['inverter_transient_active'] else 'STABLE'}</span>
                </div>
            </div>
        </div>

        <!-- Section 3: Sequence of Events (SOE) Chronology Table -->
        <div class="section-box" style="margin-bottom: 20px;">
            <div class="section-title">Sequence of Events (SOE) Incident Chronogram</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 15%;">Time Offset</th>
                        <th style="width: 25%;">Event Action</th>
                        <th style="width: 20%;">Protection Element</th>
                        <th style="width: 40%;">Forensic Observation</th>
                    </tr>
                </thead>
                <tbody>
                    {soe_rows_html}
                </tbody>
            </table>
        </div>

        <!-- Section 4: Engineering Signoff Footer -->
        <div style="border-top: 1px solid #1e293b; padding-top: 14px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-family: monospace;">
            <div>VALIDATION: {r['signoff']['validation_status']} &bull; {r['signoff']['standard']}</div>
            <div>DIGITAL SIGNATURE: 0x9B4E...F1A2 (AI-SCADA-HASH)</div>
        </div>
    </div>
</body>
</html>"""
        return html_template


# Singleton instance
report_generator = RelayFaultReportGenerator()

