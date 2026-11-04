import asyncio
import os
import time
import math
import random
import requests
from typing import Dict, Any, Optional
from datetime import datetime

CARBON_INTENSITY_API_URL = "https://api.carbonintensity.org.uk/intensity"

class LiveGridTelemetryService:
    """
    Manages telemetry from live external energy APIs (such as UK National Grid
    Carbon Intensity) and dynamically modulates the simulated grid stress,
    frequency stability, and load variations. Falls back smoothly to a stochastic
    physics-based model when offline or isolated.
    """
    def __init__(self):
        self._running = False
        self._poll_task: Optional[asyncio.Task] = None
        self.is_live_external = False
        self.last_fetch_time: Optional[str] = None
        
        # Grid parameters
        self.grid_frequency = 50.000     # Hz
        self.carbon_intensity_actual = 142 # gCO2/kWh
        self.carbon_intensity_forecast = 145
        self.carbon_index = "moderate"
        self.grid_load_factor = 0.78     # 78% of capacity
        self.grid_stress_level = 0.22    # 0.0 (idle) to 1.0 (extreme stress)
        self.generation_mix = {
            "wind": 38.5,
            "gas": 31.2,
            "nuclear": 15.0,
            "solar": 6.8,
            "biomass": 4.5,
            "imports": 4.0
        }
        self.data_source_label = "STOCHASTIC GRID MODEL (INITIALIZING)"

    async def fetch_external_telemetry(self) -> bool:
        """Fetches latest real-time carbon intensity and grid data."""
        # Fast bail-out if explicitly offline or in test mode
        if os.environ.get("GRID_TELEMETRY_OFFLINE", "0") == "1":
            self.is_live_external = False
            self.data_source_label = "STOCHASTIC DYNAMIC MODEL"
            self.last_fetch_time = datetime.utcnow().isoformat() + "Z"
            self._stochastic_tick()
            return False

        try:
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                lambda: requests.get(CARBON_INTENSITY_API_URL, timeout=1.0)
            )
            if resp.status_code == 200:
                json_data = resp.json()
                data_list = json_data.get("data", [])
                if data_list:
                    item = data_list[0]
                    intensity_info = item.get("intensity", {})
                    self.carbon_intensity_actual = intensity_info.get("actual") or intensity_info.get("forecast") or 140
                    self.carbon_intensity_forecast = intensity_info.get("forecast") or 140
                    self.carbon_index = intensity_info.get("index", "moderate")
                    
                    self.is_live_external = True
                    self.data_source_label = "LIVE EXTERNAL API (UK NATIONAL GRID)"
                    self.last_fetch_time = datetime.utcnow().isoformat() + "Z"
                    
                    base_stress = 0.15 + (min(self.carbon_intensity_actual, 350.0) / 350.0) * 0.45
                    self.grid_stress_level = round(base_stress, 3)
                    self.grid_load_factor = round(0.60 + self.grid_stress_level * 0.35, 3)
                    return True
        except Exception:
            pass
            
        # Offline or sandbox mode fallback
        self.is_live_external = False
        self.data_source_label = "STOCHASTIC DYNAMIC MODEL"
        self.last_fetch_time = datetime.utcnow().isoformat() + "Z"
        self._stochastic_tick()
        return False

    def _stochastic_tick(self):
        """Simulates realistic dynamic micro-fluctuations in grid frequency and load."""
        # Random walk for frequency around 50.00 Hz within +/- 0.04 Hz
        delta_f = random.uniform(-0.005, 0.005)
        self.grid_frequency = round(
            max(49.940, min(50.060, self.grid_frequency * 0.98 + (50.000 + delta_f) * 0.02)),
            3
        )
        # Drift load factor slightly
        self.grid_load_factor = round(
            max(0.65, min(0.95, self.grid_load_factor + random.uniform(-0.01, 0.01))),
            3
        )
        self.grid_stress_level = round(
            max(0.10, min(0.85, (self.grid_load_factor - 0.60) * 1.8 + abs(50.0 - self.grid_frequency) * 5.0)),
            3
        )

    async def _poll_loop(self):
        """Background worker periodic loop."""
        while self._running:
            await self.fetch_external_telemetry()
            # Poll external API every 60s, or run micro-updates every 2s
            for _ in range(30):
                if not self._running:
                    break
                self._stochastic_tick()
                await asyncio.sleep(2.0)

    def start(self):
        """Starts the background telemetry service."""
        if not self._running:
            self._running = True
            self._poll_task = asyncio.create_task(self._poll_loop())

    def stop(self):
        """Stops the service."""
        self._running = False
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()

    def get_status(self) -> Dict[str, Any]:
        """Returns the current state dictionary."""
        return {
            "source": self.data_source_label,
            "is_live_external": self.is_live_external,
            "last_updated": self.last_fetch_time or datetime.utcnow().isoformat() + "Z",
            "grid_frequency_hz": self.grid_frequency,
            "carbon_intensity_gco2_kwh": self.carbon_intensity_actual,
            "carbon_forecast_gco2_kwh": self.carbon_intensity_forecast,
            "carbon_index": self.carbon_index,
            "grid_load_factor": self.grid_load_factor,
            "grid_stress_level": self.grid_stress_level,
            "generation_mix": self.generation_mix
        }

grid_telemetry = LiveGridTelemetryService()
