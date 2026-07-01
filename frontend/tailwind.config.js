/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2dd4bf",
        secondary: "#64748b",
        background: "#030712",
        surface: "#0f172a",
        accent: "#a78bfa",
        muted: "#1e293b",
        glow: "#06b6d4",
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(45, 212, 191, 0.35)',
        'glow-violet': '0 0 40px -10px rgba(167, 139, 250, 0.35)',
      },
    },
  },
  plugins: [],
}
