/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        coal: { DEFAULT: "#15100c", 2: "#1f1812", 3: "#2a2019", 4: "#3a2c21" },
        line: "#4b3829",
        gold: { DEFAULT: "#f47a1f", 2: "#ff9b45", 3: "#c45a0e" },
        ember: { DEFAULT: "#e2482b", 2: "#b8321c", 3: "#ff7a5c" },
        cream: "#f6ecda",
        muted: "#c7b39b",
      },
      fontFamily: {
        display: ["'Anton'", "Impact", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        script: ["'Anton'", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.04) inset, 0 12px 30px -18px rgba(0,0,0,.9)",
        glow: "0 0 0 1px rgba(244,122,31,.5), 0 10px 30px -12px rgba(244,122,31,.55)",
      },
    },
  },
  plugins: [],
}
