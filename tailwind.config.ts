import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0faf4",
          100: "#dcf3e6",
          200: "#b9e6cf",
          300: "#87d2b1",
          400: "#4fb98d",
          500: "#2a9d73",
          600: "#157a4e",
          700: "#0f5c3a",
          800: "#0b4a2f",
          900: "#073520",
          950: "#041a12",
        },
        gold: {
          50: "#fbf7eb",
          100: "#f5ecd3",
          200: "#ecdcae",
          300: "#dfc483",
          400: "#d4b16a",
          500: "#c5a253",
          600: "#a9823f",
          700: "#86632f",
          800: "#644a24",
          900: "#4a371d",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(4 26 18 / 0.04), 0 24px 48px -32px rgb(4 26 18 / 0.25)",
        lift: "0 2px 4px rgb(4 26 18 / 0.04), 0 28px 56px -28px rgb(4 26 18 / 0.32)",
        glow: "0 18px 48px -24px rgb(197 162 83 / 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
