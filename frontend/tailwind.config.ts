/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,css}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0F1D45", 700: "#16255C", 500: "#25397E" },
        gold: { 600: "#B9891E", 500: "#D4A02B" },
        ink: { 900: "#12151C", 700: "#3A3F4B", 500: "#6B7280", 300: "#A6ACB8" },
        line: { 200: "#E2E5EA", 100: "#EEF0F3" },
        surface: { 0: "#FFFFFF", 50: "#F7F8FA", 100: "#EEF1F6" },
        success: { 600: "#1F7A4D", 100: "#E4F3EA" },
        warning: { 600: "#A66A0A", 100: "#FBF1DD" },
        danger: { 600: "#B3261E", 100: "#FBE9E8" },
        info: { 600: "#1E5FA8", 100: "#E6F0FB" },
        /* Bright student-facing accents — used only on the landing page's
           energetic sections (skills identity, games, tutor) for variety
           and read-at-a-glance color coding. Brand navy/gold remain the
           structural colors everywhere else. */
        spark: { 600: "#0C8F86", 500: "#12B3A6", 100: "#DFF7F3" },
        coral: { 600: "#D94F3D", 500: "#FF6B52", 100: "#FFE7E2" },
        sky: { 600: "#1F6FCB", 500: "#3D8BF2", 100: "#E4EFFE" },
        violet: { 600: "#6C4FD9", 500: "#8B6CF0", 100: "#EFE9FE" },
      },
      fontFamily: {
        serif: ["'Source Serif 4'", "Lora", "Georgia", "'Times New Roman'", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        "elevation-1": "0 1px 2px rgba(15,29,69,0.06)",
        "elevation-2": "0 8px 24px rgba(15,29,69,0.12)",
        "elevation-3": "0 16px 40px rgba(15,29,69,0.18)",
      },
    },
  },
  plugins: [],
};
