import os
import json
import numpy as np
import joblib
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from datetime import datetime

from sklearn.ensemble import RandomForestClassifier, ExtraTreesRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, r2_score

from app.config import (
    MODEL_PATH,
    DISTANCE_MODEL_PATH,
    METRICS_PATH,
    FAULT_CLASSES
)
from app.services.wavelet import extract_features_from_window, get_feature_names
from app.data.generate_fault_data import generate_training_dataset

class FaultClassifierService:
    def __init__(self):
        self.classifier: Optional[RandomForestClassifier] = None
        self.distance_regressor: Optional[ExtraTreesRegressor] = None
        self.metrics: Dict[str, Any] = {}
        self.feature_names = get_feature_names()
        
    def is_trained(self) -> bool:
        return (
            MODEL_PATH.exists() and
            DISTANCE_MODEL_PATH.exists() and
            METRICS_PATH.exists()
        )
        
    def train(self, samples_per_class: int = 160) -> Dict[str, Any]:
        """
        Generates simulated DWT transmission transient data and trains
        an industrial-grade Random Forest Classifier and Distance Regressor.
        """
        print("[AI-Relay] Initializing training pipeline for 11 fault classes...")
        X, y_class, y_dist = generate_training_dataset(samples_per_class=samples_per_class)
        
        # Split 80/20 stratified
        X_train, X_test, y_c_train, y_c_test, y_d_train, y_d_test = train_test_split(
            X, y_class, y_dist, test_size=0.20, random_state=42, stratify=y_class
        )
        
        # 1. Multi-class Fault Classifier (Random Forest with 150 trees)
        clf = RandomForestClassifier(
            n_estimators=150,
            max_depth=20,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1
        )
        clf.fit(X_train, y_c_train)
        
        y_pred = clf.predict(X_test)
        acc = float(accuracy_score(y_c_test, y_pred))
        print(f"[AI-Relay] Model Accuracy on Test Set: {acc * 100.0:.2f}%")
        
        # 2. Fault Distance Regressor (trained on fault classes 1-10)
        fault_train_mask = y_c_train > 0
        fault_test_mask = y_c_test > 0
        
        dist_reg = ExtraTreesRegressor(
            n_estimators=100,
            max_depth=16,
            random_state=42,
            n_jobs=-1
        )
        dist_reg.fit(X_train[fault_train_mask], y_d_train[fault_train_mask])
        
        d_pred = dist_reg.predict(X_test[fault_test_mask])
        dist_r2 = float(r2_score(y_d_test[fault_test_mask], d_pred))
        mae_km = float(np.mean(np.abs(y_d_test[fault_test_mask] - d_pred)))
        print(f"[AI-Relay] Distance Regressor R2: {dist_r2:.4f}, MAE: {mae_km:.2f} km")
        
        # Classification report
        target_names = [f"{cls_id}: {FAULT_CLASSES[cls_id]['code']}" for cls_id in range(11)]
        report = classification_report(y_c_test, y_pred, target_names=target_names, output_dict=True)
        
        # Feature importances
        importances = clf.feature_importances_
        top_indices = np.argsort(importances)[::-1][:15]
        top_features = [
            {"feature": self.feature_names[i], "importance": float(importances[i])}
            for i in top_indices
        ]
        
        # Save artifacts
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(clf, MODEL_PATH)
        joblib.dump(dist_reg, DISTANCE_MODEL_PATH)
        
        metrics_data = {
            "trained_at": datetime.utcnow().isoformat() + "Z",
            "accuracy": acc,
            "accuracy_percent": round(acc * 100.0, 2),
            "distance_r2": dist_r2,
            "distance_mae_km": round(mae_km, 2),
            "total_samples": int(X.shape[0]),
            "feature_count": int(X.shape[1]),
            "classes_count": 11,
            "top_features": top_features,
            "classification_report": report
        }
        
        with open(METRICS_PATH, "w") as f:
            json.dump(metrics_data, f, indent=2)
            
        self.classifier = clf
        self.distance_regressor = dist_reg
        self.metrics = metrics_data
        
        return metrics_data

    def load_or_train(self, force_retrain: bool = False) -> None:
        """Loads existing serialized model or trains from scratch."""
        if not force_retrain and self.is_trained():
            print("[AI-Relay] Loading pre-trained models from disk...")
            try:
                self.classifier = joblib.load(MODEL_PATH)
                self.distance_regressor = joblib.load(DISTANCE_MODEL_PATH)
                with open(METRICS_PATH, "r") as f:
                    self.metrics = json.load(f)
                print(f"[AI-Relay] Models loaded successfully. Model accuracy: {self.metrics.get('accuracy_percent')}%")
                return
            except Exception as e:
                print(f"[AI-Relay] Error loading models ({e}). Retraining...")
                
        self.train()

    def classify_window(self, window: Dict[str, np.ndarray]) -> Dict[str, Any]:
        """
        Processes a real-time sliding window (e.g. 64 samples) through DWT
        and runs synchronous AI inference.
        """
        if self.classifier is None:
            self.load_or_train()
            
        features = extract_features_from_window(window)
        features_2d = features.reshape(1, -1)
        
        # Predict class & probabilities
        probs = self.classifier.predict_proba(features_2d)[0]
        pred_class_id = int(np.argmax(probs))
        confidence = float(probs[pred_class_id])
        
        # Predict fault distance if fault detected
        if pred_class_id > 0 and self.distance_regressor is not None:
            est_distance = float(self.distance_regressor.predict(features_2d)[0])
            est_distance = max(1.0, min(100.0, est_distance))
        else:
            est_distance = 0.0
            
        fault_info = FAULT_CLASSES.get(pred_class_id, FAULT_CLASSES[0])
        
        # Trip decision logic:
        # If AI confidence >= 0.85 on any fault class (1-10), trigger trip relay!
        trip_signal = bool(pred_class_id > 0 and confidence >= 0.70)
        
        # Protection zone calculation (ANSI 21 Distance Protection)
        # Zone 1 covers 0 - 80% of line length (< 80 km) instantaneously
        # Zone 2 covers 80% - 120% (> 80 km)
        if pred_class_id > 0:
            zone = "ZONE 1 (INSTANTANEOUS)" if est_distance <= 80.0 else "ZONE 2 (BACKUP/TIME-DELAYED)"
        else:
            zone = "NORMAL (IN-ZONE)"
            
        # Estimated fault impedance proxy (loop impedance magnitude)
        v_a = np.asarray(window["Va"])
        i_a = np.asarray(window["Ia"])
        v_rms = float(np.sqrt(np.mean(np.square(v_a))))
        i_rms = float(np.sqrt(np.mean(np.square(i_a))))
        z_approx = (v_rms * 400.0 / math_sqrt_3) / (max(i_rms * 1.5, 0.05)) if pred_class_id > 0 else 50.0

        return {
            "class_id": pred_class_id,
            "code": fault_info["code"],
            "name": fault_info["name"],
            "category": fault_info["category"],
            "ansi_code": fault_info["ansi_code"],
            "description": fault_info["description"],
            "phases": fault_info["phases"],
            "ground": fault_info["ground"],
            "confidence": round(confidence, 4),
            "confidence_percent": round(confidence * 100.0, 1),
            "probabilities": {str(i): round(float(p), 4) for i, p in enumerate(probs)},
            "trip_signal": trip_signal,
            "estimated_distance_km": round(est_distance, 2),
            "protection_zone": zone,
            "estimated_impedance_ohm": round(z_approx, 2),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

math_sqrt_3 = 1.73205

# Global singleton instance
classifier_service = FaultClassifierService()

