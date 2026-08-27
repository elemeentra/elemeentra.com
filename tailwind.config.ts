import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Design tokens per PRD §14 / §19 / §36.6 — single source of truth for the
// whole app. Everything reads CSS variables so light/dark mode swaps for
// free without duplicating the palette in two places.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-page)",
        surface: "var(--bg-section)",
        card: "var(--bg-card)",
        border: "var(--border-color)",
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        crimson: {
          DEFAULT: "var(--crimson)",
          hover: "var(--crimson-hover)",
          light: "var(--crimson-light)",
          dark: "var(--crimson-dark-bg)",
        },
        watermark: "var(--watermark)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [typography],
};
export default config;
