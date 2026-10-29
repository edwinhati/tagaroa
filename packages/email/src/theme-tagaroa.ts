import type { EmailTheme } from "./components/email/email-theme.js";

/**
 * `theme-default.ts` re-tinted to Tagaroa.
 *
 * The values are the literal hex of `packages/ui/src/styles/tagaroa.css`,
 * converted out of oklch once and written down here. That conversion is
 * deliberate rather than lazy: an email client has no `color-mix`, no custom
 * properties worth relying on, and no dark mode this can honour, so the
 * palette has to arrive as flat sRGB or not at all.
 *
 * `fontFamily` names Geist first and a system stack after it. Web fonts do not
 * load in most clients; the name is there for the ones that already have it.
 */
export const tagaroaTheme: EmailTheme = {
  borderRadius: "6px",
  borderRadiusLg: "10px",
  button: {
    primary: {
      backgroundColor: "#1a1815",
      borderRadius: "6px",
      color: "#fbfaf8",
      fontSize: "14px",
      fontWeight: "500",
      paddingX: "24px",
      paddingY: "12px",
    },
    secondary: {
      backgroundColor: "transparent",
      border: "1px solid #d8dde1",
      borderRadius: "6px",
      color: "#1a1815",
      fontSize: "14px",
      fontWeight: "500",
      paddingX: "24px",
      paddingY: "12px",
    },
  },
  colorBackground: "#fcfaf5",
  colorBackgroundMuted: "#f1f0ed",
  colorBackgroundSubtle: "#ffffff",
  colorBorder: "#d8dde1",
  colorBorderSubtle: "#f1f0ed",
  colorDanger: "#a93632",
  colorPrimary: "#1a1815",
  colorPrimaryForeground: "#fbfaf8",
  colorPrimaryHover: "#3a3733",
  colorSuccess: "#00789b",
  colorText: "#1b1f23",
  colorTextMuted: "#686e74",
  colorTextSubtle: "#8b9096",
  colorWarning: "#a9763a",
  containerWidth: "600px",
  fontFamily:
    'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMono: '"Geist Mono", Menlo, Monaco, "Courier New", monospace',
  fontSizeBase: "15px",
  fontSizeHeading: "24px",
  fontSizeLg: "16px",
  fontSizeSm: "13px",
  fontSizeXl: "20px",
  fontWeightBold: "600",
  fontWeightMedium: "500",
  fontWeightNormal: "400",
  lineHeightBase: "1.6",
  spacingBase: "24px",
  spacingLg: "32px",
  spacingXl: "48px",
};
