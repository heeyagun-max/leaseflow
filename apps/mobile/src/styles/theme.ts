import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  canvasDeep: "#ebe9e4",
  canvas: "#f7f6f3",
  surface0: "#f0efeb",
  surface1: "#ffffff",
  surface2: "#f5f4f1",
  surface3: "#eceae5",
  surfaceDisabled: "#f1f0ed",
  text1: "#23211f",
  text2: "#57534e",
  text3: "#6a655f",
  textDisabled: "#8c8780",
  borderSubtle: "rgba(35, 33, 31, 0.07)",
  border: "rgba(35, 33, 31, 0.11)",
  borderStrong: "rgba(35, 33, 31, 0.20)",
  rimLight: "rgba(255, 255, 255, 0.92)",
  emerald100: "#e8f1fb",
  emerald200: "#cfe2f7",
  emerald300: "#76a9df",
  emerald400: "#3f7fbd",
  emerald500: "#2563a6",
  emerald700: "#194b7d",
  accentWash: "rgba(37, 99, 166, 0.08)",
  accentBorder: "rgba(37, 99, 166, 0.30)",
  success: "#287a4b",
  warning: "#9a5b14",
  error: "#b33a3a",
  info: "#2d69a8",
  warningWash: "rgba(154, 91, 20, 0.08)",
  errorWash: "rgba(179, 58, 58, 0.07)",
  infoWash: "rgba(45, 105, 168, 0.07)",
} as const;

export const space = {
  hairline: 4,
  tight: 8,
  compact: 12,
  control: 16,
  group: 20,
  panel: 24,
  region: 32,
  major: 40,
  section: 48,
  page: 64,
} as const;

export const radius = {
  small: 6,
  medium: 9,
  inner: 12,
  tray: 16,
  pill: 999,
} as const;

export const type = {
  display: 42,
  h1: 34,
  h2: 22,
  h3: 17,
  bodyLarge: 17,
  body: 16,
  bodySmall: 14,
  label: 12,
  data: 13,
} as const;

export const lineHeight = {
  display: 48,
  h1: 40,
  h2: 29,
  h3: 24,
  body: 25,
  bodySmall: 22,
  compact: 21,
  control: 20,
  data: 19,
  label: 17,
} as const;

export const tracking = {
  display: -1.2,
  h2: -0.35,
  h3: -0.15,
  brand: -0.3,
  label: 0.6,
  mono: 0.5,
  eyebrow: 1.1,
  technical: 0.8,
  wide: 1,
  widest: 1.3,
} as const;

export const control = {
  touch: 44,
  standard: 48,
  badge: 32,
  compactRow: 56,
  border: 1,
  focusOutline: 3,
  focusOffset: 2,
} as const;

export const icon = {
  brand: 44,
  brandInner: 14,
  glyph: 28,
  glyphLine: 10,
  glyphLineShort: 6,
  railIndex: 30,
  statusDot: 7,
  feedbackMark: 10,
  listMark: 6,
  heroSignal: 4,
} as const;

export const layout = {
  contentMax: 1280,
  copyMax: 620,
  longCopyMax: 720,
  taskCopyMax: 650,
  heroCopyFloor: 280,
  heroStatusWidth: 380,
  headingFloor: 220,
  dataFloor: 220,
  diffFloor: 220,
  commandFloor: 260,
  workflowFloor: 148,
  feedbackCopyFloor: 180,
  metricFloor: 120,
  tabletBreakpoint: 700,
  wideBreakpoint: 1080,
} as const;

export const motion = {
  hoverLift: -1,
  pressScale: 0.985,
} as const;

export const surfaceDepth: ViewStyle = {
  boxShadow: "0 1px 1px rgba(31, 29, 27, 0.02), 0 2px 4px rgba(31, 29, 27, 0.025), 0 8px 24px rgba(31, 29, 27, 0.035), 0 20px 48px rgba(31, 29, 27, 0.025)",
};

export const fonts = {
  body: Platform.select({
    ios: "SF Pro Text",
    web: "SF Pro Text, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif",
    default: "sans-serif",
  }),
  mono: Platform.select({
    ios: "SF Pro Text",
    web: "SF Pro Text, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif",
    default: "sans-serif",
  }),
} as const;

export const webPointer = Platform.select<ViewStyle>({
  web: { cursor: "pointer" },
  default: {},
});

export const tabularNumbers = Platform.select<TextStyle>({
  web: { fontVariant: ["tabular-nums"] },
  default: { fontVariant: ["tabular-nums"] },
});
