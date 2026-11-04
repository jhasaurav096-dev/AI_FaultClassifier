/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        scada: {
          bg: "#090d16",
          panel: "#0f172a",
          card: "#131d35",
          border: "#1e293b",
          highlight: "#334155",
          accent: "#38bdf8",
          phaseA: "#eab308", // Yellow
          phaseB: "#06b6d4", // Cyan / Blue
          phaseC: "#ef4444", // Red
          normal: "#10b981", // Emerald Green
          warning: "#f59e0b", // Amber
          trip: "#ef4444",   // Red
          tripGlow: "rgba(239, 68, 68, 0.4)"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-trip': 'flash 0.5s ease-in-out infinite alternate',
      },
      keyframes: {
        flash: {
          '0%': { opacity: '1', backgroundColor: 'rgba(239, 68, 68, 0.25)' },
          '100%': { opacity: '0.6', backgroundColor: 'rgba(239, 68, 68, 0.05)' },
        }
      }
    },
  },
  plugins: [],
}

