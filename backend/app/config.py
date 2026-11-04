import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODELS_DIR / "fault_classifier.joblib"
DISTANCE_MODEL_PATH = MODELS_DIR / "distance_regressor.joblib"
METRICS_PATH = MODELS_DIR / "model_metadata.json"

# Power system constants
GRID_NOMINAL_FREQ = 50.0  # Hz
SAMPLING_FREQ = 2000.0   # 2 kHz sampling rate (40 samples per 50Hz cycle)
SAMPLES_PER_CYCLE = int(SAMPLING_FREQ / GRID_NOMINAL_FREQ)  # 40 samples
WINDOW_SIZE = 64         # Analysis window size for feature extraction
LINE_LENGTH_KM = 100.0   # Total length of transmission line

# 11 Distinct Fault Classes
FAULT_CLASSES = {
    0: {
        "code": "NORMAL",
        "name": "Normal Operation (No Fault)",
        "category": "Normal",
        "phases": [],
        "ground": False,
        "ansi_code": "ANSI-NORMAL",
        "description": "Balanced 3-phase steady-state sinusoidal operation"
    },
    1: {
        "code": "LG_AG",
        "name": "Line-to-Ground Fault (Phase A-G)",
        "category": "Single Line-to-Ground",
        "phases": ["A"],
        "ground": True,
        "ansi_code": "ANSI 50G/51G/21",
        "description": "Phase A shorted to earth ground; zero-sequence surge"
    },
    2: {
        "code": "LG_BG",
        "name": "Line-to-Ground Fault (Phase B-G)",
        "category": "Single Line-to-Ground",
        "phases": ["B"],
        "ground": True,
        "ansi_code": "ANSI 50G/51G/21",
        "description": "Phase B shorted to earth ground; zero-sequence surge"
    },
    3: {
        "code": "LG_CG",
        "name": "Line-to-Ground Fault (Phase C-G)",
        "category": "Single Line-to-Ground",
        "phases": ["C"],
        "ground": True,
        "ansi_code": "ANSI 50G/51G/21",
        "description": "Phase C shorted to earth ground; zero-sequence surge"
    },
    4: {
        "code": "LL_AB",
        "name": "Line-to-Line Fault (Phase A-B)",
        "category": "Line-to-Line",
        "phases": ["A", "B"],
        "ground": False,
        "ansi_code": "ANSI 50/51/21",
        "description": "Phases A & B shorted; high opposing phase current, no ground path"
    },
    5: {
        "code": "LL_BC",
        "name": "Line-to-Line Fault (Phase B-C)",
        "category": "Line-to-Line",
        "phases": ["B", "C"],
        "ground": False,
        "ansi_code": "ANSI 50/51/21",
        "description": "Phases B & C shorted; high opposing phase current, no ground path"
    },
    6: {
        "code": "LL_CA",
        "name": "Line-to-Line Fault (Phase C-A)",
        "category": "Line-to-Line",
        "phases": ["C", "A"],
        "ground": False,
        "ansi_code": "ANSI 50/51/21",
        "description": "Phases C & A shorted; high opposing phase current, no ground path"
    },
    7: {
        "code": "LLG_ABG",
        "name": "Double Line-to-Ground (Phase A-B-G)",
        "category": "Double Line-to-Ground",
        "phases": ["A", "B"],
        "ground": True,
        "ansi_code": "ANSI 50/50G/21",
        "description": "Phases A & B grounded; severe voltage collapse & high neutral current"
    },
    8: {
        "code": "LLG_BCG",
        "name": "Double Line-to-Ground (Phase B-C-G)",
        "category": "Double Line-to-Ground",
        "phases": ["B", "C"],
        "ground": True,
        "ansi_code": "ANSI 50/50G/21",
        "description": "Phases B & C grounded; severe voltage collapse & high neutral current"
    },
    9: {
        "code": "LLG_CAG",
        "name": "Double Line-to-Ground (Phase C-A-G)",
        "category": "Double Line-to-Ground",
        "phases": ["C", "A"],
        "ground": True,
        "ansi_code": "ANSI 50/50G/21",
        "description": "Phases C & A grounded; severe voltage collapse & high neutral current"
    },
    10: {
        "code": "LLL_ABC",
        "name": "Three-Phase Symmetrical Fault (A-B-C / A-B-C-G)",
        "category": "Three-Phase Symmetrical",
        "phases": ["A", "B", "C"],
        "ground": True,
        "ansi_code": "ANSI 50/21 (CRITICAL)",
        "description": "Severe 3-phase metallic short; total voltage collapse across all phases"
    }
}

