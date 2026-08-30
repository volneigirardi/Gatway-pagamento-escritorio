export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ThemeColors {
  primary: ColorScale;
  neutral: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
  info: ColorScale;
  background: string;
  surface: string;
  "surface-elevated": string;
  text: string;
  "text-muted": string;
  border: string;
  chart?: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: { light: ThemeColors; dark: ThemeColors };
}
