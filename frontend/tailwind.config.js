/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        secondary: "#475569",
        background: "#0f172a",
        surface: "#1e293b",
        accent: "#38bdf8"
      }
    },
  },
  plugins: [],
}
