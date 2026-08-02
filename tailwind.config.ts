import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2430",
        surface: "#FFFFFF",
        canvas: "#FAFAF8",
        line: "#E4E1D8",
        brand: {
          primary: "#1E3A5F",
          accent: "#B8894A",
        },
        positive: "#4D7A5C",
        warning: "#B1543A",
      },
      fontFamily: {
        sans: ["Aptos", "Calibri", "Segoe UI", "-apple-system", "sans-serif"],
        mono: [
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        xs: "12px",
        sm: "13px",
        base: "15px",
        lg: "19px",
        xl: "26px",
        "2xl": "34px",
      },
    },
  },
  plugins: [],
};

export default config;
