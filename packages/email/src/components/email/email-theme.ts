/**
 * Trimmed from `@emailcn/react-email/theme-default`.
 *
 * Upstream also exports `createEmailTailwindConfig`, which pulls in
 * `react-email` and `tailwindcss/plugin`. The shell here is six elements with
 * inline styles, so neither dependency earns its place in a NestJS server's
 * graph and both were dropped. Re-running the shadcn CLI restores them; keep
 * this trim if it does.
 */
export interface EmailTheme {
  borderRadius: string;
  borderRadiusLg: string;
  button: {
    primary: {
      backgroundColor: string;
      borderRadius: string;
      color: string;
      fontSize: string;
      fontWeight: string;
      paddingX: string;
      paddingY: string;
    };
    secondary: {
      backgroundColor: string;
      border: string;
      borderRadius: string;
      color: string;
      fontSize: string;
      fontWeight: string;
      paddingX: string;
      paddingY: string;
    };
  };
  colorBackground: string;
  colorBackgroundMuted: string;
  colorBackgroundSubtle: string;
  colorBorder: string;
  colorBorderSubtle: string;
  colorDanger: string;
  colorPrimary: string;
  colorPrimaryForeground: string;
  colorPrimaryHover: string;
  colorSuccess: string;
  colorText: string;
  colorTextMuted: string;
  colorTextSubtle: string;
  colorWarning: string;
  containerWidth: string;
  fontFamily: string;
  fontFamilyMono: string;
  fontSizeBase: string;
  fontSizeHeading: string;
  fontSizeLg: string;
  fontSizeSm: string;
  fontSizeXl: string;
  fontWeightBold: string;
  fontWeightMedium: string;
  fontWeightNormal: string;
  lineHeightBase: string;
  spacingBase: string;
  spacingLg: string;
  spacingXl: string;
}
