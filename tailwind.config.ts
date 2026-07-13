import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#dceb0c",
          600: "#088523",
          700: "#05630c",
          900: "#7c2d12",
        },
        sidebar: {
          DEFAULT: "#133925",
          hover: "#1e293b",
          active: "#f97316",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" },
    },
  },
  plugins: [],
};
export default config;
