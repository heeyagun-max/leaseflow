import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  canvasDeep: "#050807",
  canvas: "#070b0a",
  surface0: "#0b110f",
  surface1: "#101815",
  surface2: "#16211d",
  surface3: "#1c2a25",
  surfaceDisabled: "#121916",
  text1: "#f4fbf7",
  text2: "#b6c7bf",
  text3: "#82978d",
  textDisabled: "#9aaca3",
  borderSubtle: "rgba(214, 255, 235, 0.07)",
  border: "rgba(214, 255, 235, 0.13)",
  borderStrong: "rgba(214, 255, 235, 0.23)",
  rimLight: "rgba(244, 255, 249, 0.12)",
  emerald100: "#d1fae5",
  emerald200: "#a7f3d0",
  emerald300: "#6ee7b7",
  emerald400: "#34d399",
  emerald500: "#10b981",
  emerald700: "#047857",
  accentWash: "rgba(52, 211, 153, 0.10)",
  accentBorder: "rgba(110, 231, 183, 0.34)",
  success: "#6ee7b7",
  warning: "#fcd34d",
  error: "#fda4af",
  info: "#93c5fd",
  warningWash: "rgba(252, 211, 77, 0.10)",
  errorWash: "rgba(253, 164, 175, 0.10)",
  infoWash: "rgba(147, 197, 253, 0.10)",
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
  small: 8,
  medium: 12,
  inner: 18,
  tray: 24,
  pill: 999,
} as const;

export const type = {
  display: 40,
  h1: 32,
  h2: 24,
  h3: 18,
  bodyLarge: 17,
  body: 16,
  bodySmall: 14,
  label: 12,
  data: 13,
} as const;

export const lineHeight = {
  display: 43,
  h1: 37,
  h2: 30,
  h3: 25,
  body: 25,
  bodySmall: 22,
  compact: 21,
  control: 20,
  data: 19,
  label: 17,
} as const;

export const tracking = {
  display: -1,
  h2: -0.4,
  h3: -0.2,
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

export const fonts = {
  body: Platform.select({
    ios: "Avenir Next",
    web: "Avenir Next, Apple SD Gothic Neo, Noto Sans KR, ui-rounded, sans-serif",
    default: "sans-serif",
  }),
  mono: Platform.select({
    ios: "SFMono-Regular",
    web: "SFMono-Regular, Cascadia Code, Roboto Mono, ui-monospace, monospace",
    default: "monospace",
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
