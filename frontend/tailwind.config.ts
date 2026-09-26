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
