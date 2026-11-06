import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

from app.config import FAULT_CLASSES
from app.services.classifier import classifier_service
from app.services.live_grid_api import grid_telemetry
from app.services.simulator import grid_engine
from app.services.renewable import renewable_service
from app.services.harmonics import harmonics_calculator
from app.services.report_generator import report_generator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()  # Pehle yahan app define hona zaroori hai

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AI-FaultClassifier")

# Lifecycle context manager for background workers and model loading
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SCADA Grid Telemetry & AI Model Pipeline...")
    # 1. Start live external telemetry polling
    grid_telemetry.start()
    
    # 2. Ensure model is loaded or trained
    classifier_service.load_or_train()
    logger.info("Fault Detection & Relay Subsystems Online.")
    yield
    # Shutdown
    logger.info("Shutting down background services...")
    grid_telemetry.stop()

app = FastAPI(
    title="AI-Based Fault Detection & Classification System (AI-FaultClassifier)",
    description="Industrial SCADA Transmission Grid Protection Relay & AI Inference Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration

# Enable CORS for Vercel frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ai-fault-classifier-yw12.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
#hsgsgh

# Request Models
class FaultInjectionRequest(BaseModel):
    fault_class: int = Field(..., ge=0, le=10, description="Fault class ID (0: Normal, 1-10: Faults)")
    distance_km: float = Field(default=45.0, ge=1.0, le=99.0, description="Distance from relay terminal in km")
    resistance_ohm: float = Field(default=2.5, ge=0.05, le=50.0, description="Fault arc resistance in Ohms")
    duration_ms: float = Field(default=350.0, ge=50.0, le=2000.0, description="Duration before clear in ms")

class RenewableConfigRequest(BaseModel):
    solar_enabled: Optional[bool] = None
    wind_enabled: Optional[bool] = None
    solar_penetration: Optional[float] = Field(default=None, ge=0.0, le=0.6)
    wind_penetration: Optional[float] = Field(default=None, ge=0.0, le=0.6)

# REST Endpoints
@app.get("/api/health")
async def health_check():
    return {
        "status": "OPERATIONAL",
        "subsystem": "SCADA-RELAY-AI",
        "model_trained": classifier_service.is_trained(),
        "model_accuracy": classifier_service.metrics.get("accuracy_percent", None),
        "breaker_state": grid_engine.breaker_state,
        "relay_tripped": grid_engine.relay_tripped
    }

@app.get("/api/data-source")
async def get_data_source():
    """Active data source and live grid stress telemetry."""
    return grid_telemetry.get_status()

@app.get("/api/fault-status")
async def get_fault_status():
    """Current relay trip status, active taxonomy, distance & impedance."""
    latest_step = grid_engine.step(num_samples=2)
    return {
        "relay_tripped": grid_engine.relay_tripped,
        "breaker_state": grid_engine.breaker_state,
        "trip_timestamp": grid_engine.trip_timestamp,
        "trip_latency_ms": grid_engine.trip_latency_ms,
        "active_fault_injected": grid_engine.is_fault_injected,
        "injected_fault_class": grid_engine.active_fault_class,
        "classification": latest_step["classification"],
        "trip_details": grid_engine.trip_details if grid_engine.relay_tripped else None
    }

@app.post("/api/inject-fault")
async def inject_fault(req: FaultInjectionRequest):
    """Operator fault injection endpoint."""
    grid_engine.inject_fault(
        fault_class=req.fault_class,
        distance_km=req.distance_km,
        resistance_ohm=req.resistance_ohm,
        duration_ms=req.duration_ms
    )
    fc_info = FAULT_CLASSES.get(req.fault_class, FAULT_CLASSES[0])
    logger.info(f"Operator injected fault: {fc_info['code']} at {req.distance_km} km, Rf={req.resistance_ohm} ohm")
    return {
        "status": "INJECTED",
        "fault_class": req.fault_class,
        "fault_info": fc_info,
        "distance_km": req.distance_km,
        "resistance_ohm": req.resistance_ohm,
        "duration_ms": req.duration_ms
    }

@app.post("/api/reset-relay")
async def reset_relay():
    """Reset protective relay lockout and restore closed breaker state."""
    grid_engine.reset_relay()
    logger.info("Operator triggered RELAY RESET / BREAKER RECLOSE.")
    return {
        "status": "RESET_SUCCESSFUL",
        "breaker_state": grid_engine.breaker_state,
        "relay_tripped": grid_engine.relay_tripped
    }

@app.get("/api/model-metrics")
async def get_model_metrics():
    """Returns AI model accuracy, confusion metrics, and feature importances."""
    return classifier_service.metrics

@app.get("/api/classes")
async def get_fault_classes():
    """Returns definitions and ANSI protective codes for all 11 fault classes."""
    return FAULT_CLASSES

@app.get("/api/power-quality")
async def get_power_quality():
    """Returns real-time IEEE 519 FFT harmonic spectrum and THD % for all channels."""
    return grid_engine.get_latest_power_quality()

@app.get("/api/renewable-telemetry")
async def get_renewable_telemetry():
    """Returns real-time solar PV and wind generation telemetry."""
    return renewable_service.get_telemetry()

@app.post("/api/renewable-config")
async def update_renewable_config(req: RenewableConfigRequest):
    """Adjusts dynamic Solar PV and Wind Turbine penetration and enables/disables."""
    telemetry = renewable_service.configure(
        solar_enabled=req.solar_enabled,
        wind_enabled=req.wind_enabled,
        solar_penetration=req.solar_penetration,
        wind_penetration=req.wind_penetration
    )
    logger.info(f"Renewable generation updated: Solar={telemetry['solar_penetration_pct']}%, Wind={telemetry['wind_penetration_pct']}%")
    return {"status": "UPDATED", "telemetry": telemetry}

@app.post("/api/inverter-transient")
async def trigger_inverter_transient(duration_ms: float = 400.0):
    """Simulates inverter switching transient / sudden cloud shading."""
    renewable_service.trigger_inverter_transient(duration_s=duration_ms / 1000.0)
    logger.info(f"Inverter transient triggered for {duration_ms} ms.")
    return {"status": "TRANSIENT_ACTIVE", "duration_ms": duration_ms}

@app.get("/api/export-report")
async def export_fault_report(format: str = Query("json", pattern="^(json|html)$")):
    """
    Module 3: Automated Fault Report Generator
    Exports analytical sequence-of-events fault trip report in JSON or printable SCADA HTML.
    """
    latest_step = grid_engine.step(num_samples=2)
    trip_status = latest_step.get("trip_status", {})
    classification = latest_step.get("classification", {})
    power_quality = latest_step.get("power_quality", {})
    renewable_tel = latest_step.get("renewable_telemetry", {})
    events_log = grid_engine.get_event_history()

    report_dict = report_generator.generate_report_dict(
        trip_status=trip_status,
        classification=classification,
        power_quality=power_quality,
        renewable_telemetry=renewable_tel,
        recent_events=events_log
    )

    if format == "html":
        html_content = report_generator.generate_html_report(report_dict)
        return HTMLResponse(content=html_content, status_code=200)
    
    return JSONResponse(content=report_dict, status_code=200)

# WebSocket Stream
@app.websocket("/ws/waveform-stream")
async def websocket_waveform_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("Client connected to SCADA waveform WebSocket stream.")
    
    # Task to handle incoming messages from frontend (e.g. manual fault trigger or reset)
    async def receive_handler():
        try:
            while True:
                msg_text = await websocket.receive_text()
                try:
                    payload = json.loads(msg_text)
                    action = payload.get("action")
                    if action == "INJECT_FAULT":
                        fc = int(payload.get("fault_class", 1))
                        dist = float(payload.get("distance_km", 45.0))
                        rf = float(payload.get("resistance_ohm", 2.5))
                        dur = float(payload.get("duration_ms", 350.0))
                        grid_engine.inject_fault(fc, dist, rf, dur)
                    elif action == "RESET_RELAY":
                        grid_engine.reset_relay()
                    elif action == "CLEAR_FAULT":
                        grid_engine.clear_fault()
                    elif action == "UPDATE_RENEWABLE":
                        renewable_service.configure(
                            solar_enabled=payload.get("solar_enabled"),
                            wind_enabled=payload.get("wind_enabled"),
                            solar_penetration=payload.get("solar_penetration"),
                            wind_penetration=payload.get("wind_penetration")
                        )
                    elif action == "TRIGGER_INVERTER_TRANSIENT":
                        dur_ms = float(payload.get("duration_ms", 400.0))
                        renewable_service.trigger_inverter_transient(duration_s=dur_ms / 1000.0)
                except Exception as ex:
                    logger.warning(f"Invalid WebSocket message payload: {ex}")
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    rx_task = asyncio.create_task(receive_handler())
    
    try:
        # Broadcast rate: ~30 frames per second, 8 samples per frame
        while getattr(websocket, "client_state", None) and websocket.client_state.name == "CONNECTED":
            frame_data = grid_engine.step(num_samples=8)
            await websocket.send_json(frame_data)
            await asyncio.sleep(0.033)  # ~30 Hz frame rate
    except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
        logger.info("Client disconnected from waveform WebSocket.")
    except Exception as e:
        logger.warning(f"WebSocket streaming loop terminated: {e}")
    finally:
        rx_task.cancel()
