/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#10B981",
        "primary-dark": "#059669",
        "secondary-light": "#D1FAE5",
        "text-dark": "#1F2937",
        "text-gray": "#6B7280",
        "border-gray": "#E5E7EB",
        "bg-light": "#F9FAFB",
        "bg-sidebar": "#F3F4F6",
        "warning-yellow": "#FBBF24",
        "error-red": "#EF4444",
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["28px", { lineHeight: "36px", fontWeight: "600" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h3: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        small: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        button: ["14px", { lineHeight: "20px", fontWeight: "500" }],
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
      },
    },
  },
  plugins: [],
};
