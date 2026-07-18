import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  colors,
  control,
  fonts,
  icon,
  layout,
  lineHeight,
  motion,
  radius,
  space,
  tabularNumbers,
  tracking,
  type,
  webPointer,
} from "../styles/theme";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "error";

interface GovernanceSurfaceProps {
  children: ReactNode;
  accent?: boolean;
  subtle?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function GovernanceSurface({
  children,
  accent = false,
  subtle = false,
  style,
  accessibilityLabel,
}: GovernanceSurfaceProps) {
  const increasedContrast = useIncreasedContrast();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.surfaceTray, accent && styles.surfaceTrayAccent, subtle && styles.surfaceTraySubtle, increasedContrast && styles.surfaceTrayHighContrast, style]}
    >
      <View style={[styles.surfaceCore, accent && styles.surfaceCoreAccent, subtle && styles.surfaceCoreSubtle, increasedContrast && styles.surfaceCoreHighContrast]}>
        {children}
      </View>
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  compact?: boolean;
}

export function ActionButton({
  label,
  onPress,
  variant = "secondary",
  disabled = false,
  loading = false,
  hint,
  compact = false,
}: ActionButtonProps) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const increasedContrast = useIncreasedContrast();
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        styles[`button_${variant}`],
        hovered && !unavailable && styles.buttonHovered,
        hovered && !unavailable && !reducedMotion && styles.buttonHoveredMotion,
        focused && styles.buttonFocused,
        increasedContrast && styles.buttonHighContrast,
        pressed && styles.buttonPressedFeedback,
        pressed && !reducedMotion && styles.buttonPressedMotion,
        unavailable && styles.buttonDisabled,
        webPointer,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? colors.canvas : colors.emerald200} /> : null}
      <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`], unavailable && styles.buttonLabelDisabled]}>
        {loading ? `${label} 처리 중` : label}
      </Text>
      {variant === "primary" && !loading ? (
        <View style={styles.buttonGlyph} accessibilityElementsHidden>
          <View style={styles.buttonGlyphLine} />
          <View style={[styles.buttonGlyphLine, styles.buttonGlyphLineOffset]} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function StatusBadge({ label, tone = "neutral", live = false }: {
  label: string;
  tone?: StatusTone;
  live?: boolean;
}) {
  const increasedContrast = useIncreasedContrast();
  return (
    <View
      accessibilityLiveRegion={live ? "polite" : "none"}
      style={[styles.badge, styles[`badge_${tone}`], increasedContrast && styles.badgeHighContrast]}
    >
      <View style={[styles.badgeDot, styles[`badgeDot_${tone}`]]} />
      <Text style={[styles.badgeText, styles[`badgeText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function SectionHeading({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const increasedContrast = useIncreasedContrast();
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        <Text style={[styles.eyebrow, increasedContrast && styles.eyebrowHighContrast]}>{eyebrow}</Text>
        <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={[styles.sectionDescription, increasedContrast && styles.secondaryTextHighContrast]}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.sectionAction}>{action}</View> : null}
    </View>
  );
}

export function MetricCard({ value, label, tone = "neutral" }: {
  value: string | number;
  label: string;
  tone?: StatusTone;
}) {
  const increasedContrast = useIncreasedContrast();
  const toneStyle = tone === "neutral" ? null : styles[`metric_${tone}`];
  const valueToneStyle = tone === "neutral" ? null : styles[`metricValue_${tone}`];
  return (
    <View style={[styles.metric, toneStyle, increasedContrast && styles.metricHighContrast]}>
      <Text style={[styles.metricValue, valueToneStyle]}>{value}</Text>
      <Text style={[styles.metricLabel, increasedContrast && styles.metricLabelHighContrast]}>{label}</Text>
    </View>
  );
}

export function DataRow({ label, value, detail, tone = "neutral" }: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "candidate" | "verified";
}) {
  const increasedContrast = useIncreasedContrast();
  return (
    <View style={[styles.dataRow, tone === "verified" && styles.dataRowVerified, tone === "candidate" && styles.dataRowCandidate, increasedContrast && styles.dataRowHighContrast]}>
      <Text style={[styles.dataLabel, increasedContrast && styles.dataLabelHighContrast]}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
      {detail ? <Text style={[styles.dataDetail, increasedContrast && styles.secondaryTextHighContrast]}>{detail}</Text> : null}
    </View>
  );
}

export function WorkflowRail({ steps, compact = false }: {
  steps: Array<{ label: string; state: "pending" | "current" | "complete" | "blocked" }>;
  compact?: boolean;
}) {
  const increasedContrast = useIncreasedContrast();
  return (
    <View accessibilityRole="list" style={[styles.workflowRail, compact && styles.workflowRailCompact]}>
      {steps.map((step, index) => (
        <View
          key={step.label}
          accessibilityLabel={`${index + 1}단계 ${step.label}, ${workflowStateLabel(step.state)}`}
          style={[styles.workflowStep, step.state === "current" && styles.workflowStepCurrent, increasedContrast && styles.workflowStepHighContrast]}
        >
          <View style={[styles.workflowIndex, styles[`workflowIndex_${step.state}`], increasedContrast && styles.workflowIndexHighContrast]}>
            <Text style={[styles.workflowIndexText, step.state === "complete" && styles.workflowIndexTextComplete, increasedContrast && styles.workflowIndexTextHighContrast]}>
              {step.state === "complete" ? "✓" : index + 1}
            </Text>
          </View>
          <View style={styles.workflowCopy}>
            <Text style={[styles.workflowLabel, increasedContrast && styles.workflowLabelHighContrast]}>{step.label}</Text>
            <Text style={[styles.workflowState, styles[`workflowState_${step.state}`], increasedContrast && step.state === "pending" && styles.workflowStateHighContrast]}>
              {workflowStateLabel(step.state)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function FeedbackPanel({ tone, title, description, action }: {
  tone: Exclude<StatusTone, "neutral">;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const increasedContrast = useIncreasedContrast();
  const role: AccessibilityRole | undefined = tone === "error" ? "alert" : "summary";
  return (
    <View
      accessibilityRole={role}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[styles.feedback, styles[`feedback_${tone}`], increasedContrast && styles.feedbackHighContrast]}
    >
      <View style={[styles.feedbackMark, styles[`feedbackMark_${tone}`]]} />
      <View style={styles.feedbackCopy}>
        <Text style={[styles.feedbackTitle, increasedContrast && styles.workflowLabelHighContrast]}>{title}</Text>
        <Text style={[styles.feedbackDescription, increasedContrast && styles.secondaryTextHighContrast]}>{description}</Text>
      </View>
      {action ? <View style={styles.feedbackAction}>{action}</View> : null}
    </View>
  );
}

export function MonoText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const increasedContrast = useIncreasedContrast();
  return <Text style={[styles.mono, increasedContrast && styles.secondaryTextHighContrast, style]}>{children}</Text>;
}

export function Divider() {
  const increasedContrast = useIncreasedContrast();
  return <View style={[styles.divider, increasedContrast && styles.dividerHighContrast]} />;
}

function workflowStateLabel(state: "pending" | "current" | "complete" | "blocked") {
  if (state === "complete") return "완료";
  if (state === "current") return "현재 단계";
  if (state === "blocked") return "차단됨";
  return "대기";
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function useIncreasedContrast(): boolean {
  const [increasedContrast, setIncreasedContrast] = useState(false);

  useEffect(() => {
    let mounted = true;
    const subscription = Platform.OS === "web"
      ? null
      : AccessibilityInfo.addEventListener("highTextContrastChanged", setIncreasedContrast);
    if (Platform.OS !== "web") {
      void AccessibilityInfo.isHighTextContrastEnabled().then((enabled) => {
        if (mounted) setIncreasedContrast(enabled);
      });
    }
    const contrastQuery = typeof window === "undefined"
      ? null
      : window.matchMedia("(prefers-contrast: more)");
    const handleContrastChange = (event: MediaQueryListEvent) => setIncreasedContrast(event.matches);
    if (contrastQuery) {
      setIncreasedContrast(contrastQuery.matches);
      contrastQuery.addEventListener("change", handleContrastChange);
    }
    return () => {
      mounted = false;
      subscription?.remove();
      contrastQuery?.removeEventListener("change", handleContrastChange);
    };
  }, []);

  return increasedContrast;
}

const styles = StyleSheet.create({
  surfaceTray: {
    backgroundColor: colors.surface0,
    borderColor: colors.borderSubtle,
    borderRadius: radius.tray,
    borderWidth: control.border,
    maxWidth: "100%",
    minWidth: 0,
    padding: space.hairline,
  },
  surfaceTrayAccent: { borderColor: colors.accentBorder },
  surfaceTraySubtle: { backgroundColor: colors.canvasDeep },
  surfaceTrayHighContrast: { borderColor: colors.text2 },
  surfaceCore: {
    backgroundColor: colors.surface1,
    borderColor: colors.border,
    borderRadius: radius.inner,
    borderTopColor: colors.rimLight,
    borderWidth: control.border,
    maxWidth: "100%",
    minWidth: 0,
    padding: space.group,
  },
  surfaceCoreAccent: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  surfaceCoreSubtle: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle },
  surfaceCoreHighContrast: { borderColor: colors.text3 },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.medium,
    borderWidth: control.border,
    flexDirection: "row",
    gap: space.tight,
    justifyContent: "center",
    maxWidth: "100%",
    minHeight: control.standard,
    paddingHorizontal: space.control,
    paddingVertical: space.compact,
  },
  buttonCompact: { minHeight: control.touch, paddingVertical: space.tight },
  button_primary: { backgroundColor: colors.emerald300, borderColor: colors.emerald300, borderRadius: radius.pill },
  button_secondary: { backgroundColor: colors.surface2, borderColor: colors.border },
  button_ghost: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle },
  button_danger: { backgroundColor: colors.errorWash, borderColor: colors.error },
  buttonHovered: { borderColor: colors.borderStrong },
  buttonHoveredMotion: { transform: [{ translateY: motion.hoverLift }] },
  buttonFocused: { borderColor: colors.emerald200, outlineColor: colors.emerald200, outlineOffset: control.focusOffset, outlineStyle: "solid", outlineWidth: control.focusOutline },
  buttonHighContrast: { borderColor: colors.text2 },
  buttonPressedFeedback: { borderColor: colors.emerald200 },
  buttonPressedMotion: { transform: [{ scale: motion.pressScale }] },
  buttonDisabled: { backgroundColor: colors.surfaceDisabled, borderColor: colors.borderSubtle },
  buttonLabel: { flexShrink: 1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control },
  buttonLabel_primary: { color: colors.canvas },
  buttonLabel_secondary: { color: colors.text1 },
  buttonLabel_ghost: { color: colors.text2 },
  buttonLabel_danger: { color: colors.error },
  buttonLabelDisabled: { color: colors.textDisabled },
  buttonGlyph: {
    alignItems: "center",
    backgroundColor: colors.emerald700,
    borderRadius: radius.pill,
    height: icon.glyph,
    justifyContent: "center",
    width: icon.glyph,
  },
  buttonGlyphLine: { backgroundColor: colors.emerald100, height: control.border, width: icon.glyphLine },
  buttonGlyphLineOffset: { marginTop: space.hairline, width: icon.glyphLineShort },
  badge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: control.border,
    flexDirection: "row",
    gap: space.tight,
    minHeight: control.badge,
    paddingHorizontal: space.compact,
    paddingVertical: space.hairline,
  },
  badge_neutral: { backgroundColor: colors.surface2, borderColor: colors.border },
  badge_info: { backgroundColor: colors.infoWash, borderColor: colors.info },
  badge_warning: { backgroundColor: colors.warningWash, borderColor: colors.warning },
  badge_success: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  badge_error: { backgroundColor: colors.errorWash, borderColor: colors.error },
  badgeHighContrast: { borderColor: colors.text2 },
  badgeDot: { borderRadius: radius.pill, height: icon.statusDot, width: icon.statusDot },
  badgeDot_neutral: { backgroundColor: colors.text3 },
  badgeDot_info: { backgroundColor: colors.info },
  badgeDot_warning: { backgroundColor: colors.warning },
  badgeDot_success: { backgroundColor: colors.success },
  badgeDot_error: { backgroundColor: colors.error },
  badgeText: { fontFamily: fonts.body, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.label },
  badgeText_neutral: { color: colors.text2 },
  badgeText_info: { color: colors.info },
  badgeText_warning: { color: colors.warning },
  badgeText_success: { color: colors.success },
  badgeText_error: { color: colors.error },
  sectionHeading: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: space.control, justifyContent: "space-between" },
  sectionHeadingCopy: { flexGrow: 1, flexShrink: 1, maxWidth: "100%", minWidth: 0 },
  sectionAction: { alignItems: "flex-end" },
  eyebrow: { color: colors.emerald400, fontFamily: fonts.mono, fontSize: type.label, fontWeight: "600", letterSpacing: tracking.eyebrow, marginBottom: space.tight },
  eyebrowHighContrast: { color: colors.emerald200 },
  sectionTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h2, fontWeight: "400", letterSpacing: tracking.h2, lineHeight: lineHeight.h2 },
  sectionDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.bodySmall, marginTop: space.tight, maxWidth: layout.copyMax },
  secondaryTextHighContrast: { color: colors.text1 },
  metric: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.metricFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.control },
  metric_success: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  metric_warning: { backgroundColor: colors.warningWash, borderColor: colors.warning },
  metric_info: { backgroundColor: colors.infoWash, borderColor: colors.info },
  metric_error: { backgroundColor: colors.errorWash, borderColor: colors.error },
  metricHighContrast: { borderColor: colors.text2 },
  metricValue: { color: colors.text1, fontFamily: fonts.body, fontSize: type.h2, fontWeight: "400", lineHeight: lineHeight.h2, ...tabularNumbers },
  metricValue_success: { color: colors.emerald200 },
  metricValue_warning: { color: colors.warning },
  metricValue_info: { color: colors.info },
  metricValue_error: { color: colors.error },
  metricLabel: { color: colors.text3, fontFamily: fonts.body, fontSize: type.label, lineHeight: lineHeight.label, marginTop: space.hairline },
  metricLabelHighContrast: { color: colors.text1 },
  dataRow: { backgroundColor: colors.surface0, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.dataFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0, padding: space.compact },
  dataRowVerified: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  dataRowCandidate: { backgroundColor: colors.infoWash, borderColor: colors.info },
  dataRowHighContrast: { borderColor: colors.text2 },
  dataLabel: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.label, letterSpacing: tracking.mono, marginBottom: space.hairline },
  dataLabelHighContrast: { color: colors.emerald200 },
  dataValue: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact },
  dataDetail: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.data, lineHeight: lineHeight.data, marginTop: space.hairline },
  workflowRail: { flexDirection: "row", flexWrap: "wrap", gap: space.tight },
  workflowRailCompact: { gap: space.hairline },
  workflowStep: { alignItems: "center", backgroundColor: colors.surface0, borderColor: colors.borderSubtle, borderRadius: radius.medium, borderWidth: control.border, flexBasis: layout.workflowFloor, flexGrow: 1, flexDirection: "row", gap: space.compact, maxWidth: "100%", minHeight: control.compactRow, minWidth: 0, padding: space.compact },
  workflowStepCurrent: { borderColor: colors.accentBorder },
  workflowStepHighContrast: { borderColor: colors.text2 },
  workflowIndex: { alignItems: "center", borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: control.border, height: icon.railIndex, justifyContent: "center", width: icon.railIndex },
  workflowIndex_pending: { backgroundColor: colors.surface2 },
  workflowIndex_current: { backgroundColor: colors.infoWash, borderColor: colors.info },
  workflowIndex_complete: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  workflowIndex_blocked: { backgroundColor: colors.errorWash, borderColor: colors.error },
  workflowIndexText: { color: colors.text2, fontFamily: fonts.mono, fontSize: type.data, fontWeight: "500" },
  workflowIndexTextComplete: { color: colors.success },
  workflowIndexHighContrast: { borderColor: colors.text1 },
  workflowIndexTextHighContrast: { color: colors.text1 },
  workflowCopy: { flex: 1, minWidth: 0 },
  workflowLabel: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.data },
  workflowLabelHighContrast: { color: colors.text1 },
  workflowState: { fontFamily: fonts.body, fontSize: type.label, lineHeight: lineHeight.label, marginTop: control.focusOffset },
  workflowState_pending: { color: colors.text3 },
  workflowState_current: { color: colors.info },
  workflowState_complete: { color: colors.success },
  workflowState_blocked: { color: colors.error },
  workflowStateHighContrast: { color: colors.text1 },
  feedback: { alignItems: "flex-start", borderRadius: radius.medium, borderWidth: control.border, flexDirection: "row", flexWrap: "wrap", gap: space.compact, maxWidth: "100%", minWidth: 0, padding: space.control },
  feedback_info: { backgroundColor: colors.infoWash, borderColor: colors.info },
  feedback_warning: { backgroundColor: colors.warningWash, borderColor: colors.warning },
  feedback_success: { backgroundColor: colors.accentWash, borderColor: colors.accentBorder },
  feedback_error: { backgroundColor: colors.errorWash, borderColor: colors.error },
  feedbackHighContrast: { borderColor: colors.text2 },
  feedbackMark: { borderRadius: radius.pill, height: icon.feedbackMark, marginTop: space.hairline, width: icon.feedbackMark },
  feedbackMark_info: { backgroundColor: colors.info },
  feedbackMark_warning: { backgroundColor: colors.warning },
  feedbackMark_success: { backgroundColor: colors.success },
  feedbackMark_error: { backgroundColor: colors.error },
  feedbackCopy: { flexBasis: layout.feedbackCopyFloor, flexGrow: 1, maxWidth: "100%", minWidth: 0 },
  feedbackTitle: { color: colors.text1, fontFamily: fonts.body, fontSize: type.bodySmall, fontWeight: "500", lineHeight: lineHeight.control },
  feedbackDescription: { color: colors.text2, fontFamily: fonts.body, fontSize: type.bodySmall, lineHeight: lineHeight.compact, marginTop: space.hairline },
  feedbackAction: { width: "100%" },
  mono: { color: colors.text3, fontFamily: fonts.mono, fontSize: type.data, lineHeight: lineHeight.data, ...tabularNumbers },
  divider: { backgroundColor: colors.borderSubtle, height: control.border, marginVertical: space.group, width: "100%" },
  dividerHighContrast: { backgroundColor: colors.text2 },
});
