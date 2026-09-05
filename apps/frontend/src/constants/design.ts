export const COLORS = {
  primary: "#10B981",
  primaryDark: "#059669",
  secondaryLight: "#D1FAE5",
  textDark: "#1F2937",
  textGray: "#6B7280",
  borderGray: "#E5E7EB",
  bgWhite: "#FFFFFF",
  bgLight: "#F9FAFB",
  bgSidebar: "#F3F4F6",
  successGreen: "#10B981",
  warningYellow: "#FBBF24",
  errorRed: "#EF4444",
} as const;

export const SPACING = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
} as const;

export const TYPOGRAPHY = {
  fontFamily: "Inter, Segoe UI, sans-serif",
  h1: { size: "28px", weight: 600 },
  h2: { size: "24px", weight: 600 },
  h3: { size: "20px", weight: 600 },
  body: { size: "14px", weight: 400 },
  small: { size: "12px", weight: 400 },
  button: { size: "14px", weight: 500 },
} as const;

export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;