/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,css}"],
  theme: {
    extend: {
      colors: {
        /* ========================================
         6 Color Worlds from tokens.css §3
         ======================================== */

        /* Coral: Translation (Lime) */
        "world-coral-50": "#FAFFF0",
        "world-coral-100": "#F5FFD5",
        "world-coral-200": "#E0FFB7",
        "world-coral-300": "#CFFF99",
        "world-coral-400": "#B6FF73",
        "world-coral-500": "#B6E83C",
        "world-coral-600": "#98CC27",
        "world-coral-700": "#7AA81C",

        /* Amber: Writing (Tangerine) */
        "world-amber-50": "#FFFDF0",
        "world-amber-100": "#FFFDCC",
        "world-amber-200": "#FFFAB2",
        "world-amber-300": "#FFFAA8",
        "world-amber-400": "#FFAA7E",
        "world-amber-500": "#FF9A3D",
        "world-amber-600": "#E07A2E",
        "world-amber-700": "#C05A20",

        /* Mint: Listening (Mint) */
        "world-mint-50": "#E6FFFB",
        "world-mint-100": "#CCFFEB",
        "world-mint-200": "#99FFD6",
        "world-mint-300": "#66FFC7",
        "world-mint-400": "#33FFA8",
        "world-mint-500": "#35DCA8",
        "world-mint-600": "#27AFA0",
        "world-mint-700": "#1A8277",

        /* Sky: Reading (Sky) */
        "world-sky-50": "#E8F6FF",
        "world-sky-100": "#B2E8FF",
        "world-sky-200": "#8CDCFF",
        "world-sky-300": "#59C1FF",
        "world-sky-400": "#2AB8FF",
        "world-sky-500": "#4DB8FF",
        "world-sky-600": "#3A9AD9",
        "world-sky-700": "#277CC4",

        /* Violet: Grammar (Blueberry) */
        "world-violet-50": "#F0F2FF",
        "world-violet-100": "#D6DDFF",
        "world-violet-200": "#BCC8FF",
        "world-violet-300": "#A2B0FF",
        "world-violet-400": "#8896FF",
        "world-violet-500": "#7C8CFF",
        "world-violet-600": "#6877E8",
        "world-violet-700": "#5463D0",

        /* Rose: Vocabulary (Bubblegum) */
        "world-rose-50": "#FFF0F5",
        "world-rose-100": "#FFD8E0",
        "world-rose-200": "#FFB8CF",
        "world-rose-300": "#FF99BC",
        "world-rose-400": "#FF78A0",
        "world-rose-500": "#FF6FA5",
        "world-rose-600": "#E05A8E",
        "world-rose-700": "#C04578",

        /* Neutrals from tokens.css §3.1 - full scales */
        surface: {
          0: "#FFFFFF",
          50: "#FAFBFC",
          100: "#F5F7FA",
          200: "#EEF0F5",
        },
        stroke: "#1A1530", /* ink */
        muted: "#4A4566",   /* ink-2 */

        /* Existing brand colors (kept for compatibility) */
        navy: { 900: "#0F1D45", 700: "#16255C", 500: "#25397E" },
        gold: { 600: "#B9891E", 500: "#D4A02B" },
        ink: { 900: "#12151C", 700: "#3A3F4B", 500: "#6B7280", 300: "#A6ACB8" },
        line: { 200: "#E2E5EA", 100: "#EEF0F3" },
        success: { 600: "#1F7A4D", 100: "#E4F3EA" },
        warning: { 600: "#A66A0A", 100: "#FBF1DD" },
        danger: { 600: "#B3261E", 100: "#FBE9E8" },
        info: { 600: "#1E5FA8", 100: "#E6F0FB" },
        spark: { 600: "#0C8F86", 500: "#12B3A6", 100: "#DFF7F3" },
      },
      borderWidth: {
        /* Default 2px stroke */
        "2": "2px",
      },
      boxShadow: {
        /* ========================================
         Arcade Retro Shadows (hard offset, no blur)
         From tokens.css §6.2 - shadow-sm, shadow-md, shadow-lg
         ======================================== */
        "retro-sm": "2px 2px #000",
        "retro-md": "4px 4px #000",
        "retro-lg": "8px 8px #000",

        /* Keep existing elevations */
        "elevation-1": "0 1px 2px rgba(15,29,69,0.06)",
        "elevation-2": "0 8px 24px rgba(15,29,69,0.12)",
        "elevation-3": "0 16px 40px rgba(15,29,69,0.18)",
      },
      fontFamily: {
        /* ========================================
         Typography font families from tokens.css
         ======================================== */
        heading: ["Fredoka", "sans-serif"],
        body: ["Figtree", "system-ui", "sans-serif"],
        accent: ["Caveat", "cursive"],
        arabic: ["Amiri", "serif"],
        /* Keep existing sans */
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      animation: {
        /* ========================================
         Custom animation keyframes
         ======================================== */

        /* Sticker wiggles - subtle rotation shake */
        "wiggle": "wiggle 0.6s ease-in-out infinite",

        /* Celebration burst */
        "burst": "burst 0.5s ease-out",

        /* Pulse animation */
        "pulse": "pulse 2s ease-in-out infinite",
      },
    },
    /* ========================================
     Core utilities that map directly to CSS tokens
     ======================================== */

    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
  },
  plugins: [
    /* ========================================
     Custom plugin to make CSS custom properties
     available as Tailwind utilities
     ======================================== */
    function ({ addUtilities, theme }) {
      const colors = theme("colors", {});
      const shadows = theme("boxShadow", {});
      const fonts = theme("fontFamily", {});

      /* ========================================
      Color utilities
      ======================================== */
      const colorUtilities = Object.entries(colors).reduce((acc, [key, value]) => {
        if (typeof value === "object" && !(value instanceof Array)) {
          // Handle named color sets with shades (e.g., surface: {50: ..., 100: ...})
          Object.entries(value).forEach(([shade, hex]) => {
            acc[`.bg-${key}-${shade}`] = { backgroundColor: hex };
            acc[`.text-${key}-${shade}`] = { color: hex };
            acc[`.border-${key}-${shade}`] = { borderColor: hex };
          });
          // Also add default (no shade) if first key is numeric
          const firstKey = Object.keys(value)[0];
          if (!isNaN(parseInt(firstKey))) {
            // Already added above with shade
          }
        } else if (typeof value === "string") {
          // Handle single color values
          acc[`.bg-${key}`] = { backgroundColor: value };
          acc[`.text-${key}`] = { color: value };
          acc[`.border-${key}`] = { borderColor: value };
        }
        return acc;
      }, {});

      /* ========================================
      Shadow utilities
      ======================================== */
      const shadowUtilities = Object.entries(shadows).reduce((acc, [key, value]) => {
        if (typeof value === "string") {
          acc[`.${key}`] = {
            boxShadow: value,
          };
        }
        return acc;
      }, {});

      /* ========================================
      Font family utilities
      ======================================== */
      const fontUtilities = Object.entries(fonts).reduce((acc, [key, value]) => {
        if (Array.isArray(value)) {
          acc[`.font-${key}`] = {
            fontFamily: value.join(","),
          };
        }
        return acc;
      }, {});

      addUtilities(colorUtilities, ["responsive", "hover"]);
      addUtilities(shadowUtilities);
      addUtilities(fontUtilities);
    },
  ],
};