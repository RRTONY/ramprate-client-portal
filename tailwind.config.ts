import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5effe",
          100: "#e9dcfb",
          500: "#7E32D4",
          600: "#6a28b4",
          700: "#5A1E9C",
          900: "#201F24",
        },
        ink: "#201F24",
        violet: "#A454FF",
      },
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
