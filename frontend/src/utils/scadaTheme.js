export const PHASE_COLORS = {
  Va: "#eab308", // Yellow (Phase A)
  Vb: "#06b6d4", // Cyan (Phase B)
  Vc: "#ef4444", // Red (Phase C)
  Ia: "#f59e0b", // Amber/Gold (Phase A current)
  Ib: "#38bdf8", // Light Blue (Phase B current)
  Ic: "#f87171", // Light Red (Phase C current)
  I0: "#a855f7", // Violet (Neutral/Residual current)
};

export const FAULT_TAXONOMY_MAP = {
  0: { code: "NORMAL", name: "Normal Operation (No Fault)", category: "Balanced Normal", color: "#10b981", ansi: "NORMAL" },
  1: { code: "LG_AG", name: "Single Line-to-Ground (A-G)", category: "Line-to-Ground", color: "#ef4444", ansi: "50G/51G/21" },
  2: { code: "LG_BG", name: "Single Line-to-Ground (B-G)", category: "Line-to-Ground", color: "#ef4444", ansi: "50G/51G/21" },
  3: { code: "LG_CG", name: "Single Line-to-Ground (C-G)", category: "Line-to-Ground", color: "#ef4444", ansi: "50G/51G/21" },
  4: { code: "LL_AB", name: "Line-to-Line (A-B)", category: "Line-to-Line", color: "#f59e0b", ansi: "50/51/21" },
  5: { code: "LL_BC", name: "Line-to-Line (B-C)", category: "Line-to-Line", color: "#f59e0b", ansi: "50/51/21" },
  6: { code: "LL_CA", name: "Line-to-Line (C-A)", category: "Line-to-Line", color: "#f59e0b", ansi: "50/51/21" },
  7: { code: "LLG_ABG", name: "Double Line-to-Ground (A-B-G)", category: "Double Line-to-Ground", color: "#ef4444", ansi: "50/50G/21" },
  8: { code: "LLG_BCG", name: "Double Line-to-Ground (B-C-G)", category: "Double Line-to-Ground", color: "#ef4444", ansi: "50/50G/21" },
  9: { code: "LLG_CAG", name: "Double Line-to-Ground (C-A-G)", category: "Double Line-to-Ground", color: "#ef4444", ansi: "50/50G/21" },
  10: { code: "LLL_ABC", name: "Three-Phase Symmetrical (A-B-C / A-B-C-G)", category: "Symmetrical Bolted", color: "#dc2626", ansi: "50/21 CRITICAL" }
};

export function formatPerUnit(val) {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return Number(val).toFixed(2);
}

export function formatFrequency(hz) {
  if (!hz) return "50.000";
  return Number(hz).toFixed(3);
}

