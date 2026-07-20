import { z } from "zod/v3";

export const weeklyCadenceSchema = z.enum(["weekly", "biweekly", "monthly"]);
export const meetingWeekdaySchema = z.enum([
  "monday", "tuesday", "wednesday", "thursday", "friday",
]);

export const weeklyRecipientRoleSchema = z.enum([
  "to_landlord_practical",
  "cc_landlord_team",
  "cc_landlord_exec",
  "cc_lm_team",
  "cc_lm_exec",
]);

export const weeklyReportSectionKeySchema = z.enum([
  "key_issue",
  "changes_since_last_report",
  "activity_summary",
  "negotiated_area_floor_changes",
  "competitor_buildings",
  "blocker_and_pending_approval",
  "next_actions",
]);

export const weeklyReportSectionLabels: Record<z.infer<typeof weeklyReportSectionKeySchema>, string> = {
  key_issue: "핵심 이슈",
  changes_since_last_report: "지난 보고 이후 변경",
  activity_summary: "문의·제안·투어 활동",
  negotiated_area_floor_changes: "협의 면적·층 변경",
  competitor_buildings: "경쟁 건물",
  blocker_and_pending_approval: "막힌 일·승인 대기",
  next_actions: "다음 행동·담당·기한",
};

export const defaultWeeklyAutomation = {
  aggregation_days: 7,
  required_section_keys: weeklyReportSectionKeySchema.options,
  checkpoints: {
    pre_summary_time: "16:00",
    morning_refresh_time: "08:00",
    final_review_time: "09:30",
    delivery_time: "10:00",
  },
} as const;

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const weeklyAutomationSchema = z.object({
  aggregation_days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  required_section_keys: z.array(weeklyReportSectionKeySchema).min(1).max(weeklyReportSectionKeySchema.options.length)
    .refine((keys) => new Set(keys).size === keys.length, "필수 보고 내용은 중복 없이 선택해 주세요."),
  checkpoints: z.object({
    pre_summary_time: timeSchema,
    morning_refresh_time: timeSchema,
    final_review_time: timeSchema,
    delivery_time: timeSchema,
  }).strict(),
}).strict();

const recipientSchema = z.object({
  email: z.string().email(),
  role: weeklyRecipientRoleSchema,
}).strict();

export const weeklyRecipientsSchema = z.object({
  to: z.array(recipientSchema.extend({ role: z.literal("to_landlord_practical") })).length(1),
  cc: z.array(recipientSchema.extend({
    role: z.enum(["cc_landlord_team", "cc_landlord_exec", "cc_lm_team", "cc_lm_exec"]),
  })).length(4),
}).strict();

export const weeklySettingsInputSchema = z.object({
  landlord_name: z.string().trim().min(2).max(80),
  building_ids: z.array(z.string().min(1)).min(1).max(20),
  cadence: weeklyCadenceSchema,
  meeting_weekday: meetingWeekdaySchema,
  meeting_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  next_meeting_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  owner_user_id: z.string().min(1),
  approver_user_id: z.string().min(1),
  recipients: weeklyRecipientsSchema,
  automation: weeklyAutomationSchema.default(defaultWeeklyAutomation),
}).strict();

export const weeklyReportGroupSchema = weeklySettingsInputSchema.extend({
  ref: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  report_scope: z.literal("building_specific"),
  configuration_revision: z.number().int().positive(),
  updated_by: z.string().min(1),
  updated_at: z.string().datetime(),
}).strict();

export const weeklySettingsAuditSchema = z.object({
  id: z.string().min(1),
  event_type: z.enum(["weekly_settings.created", "weekly_settings.updated", "weekly_settings.reset"]),
  actor_id: z.string().min(1),
  actor_role: z.enum(["data_steward", "senior_reviewer", "lm_manager", "lm_member", "team_lead", "admin"]),
  group_ref: z.string().min(1).nullable(),
  occurred_at: z.string().datetime(),
  revision: z.number().int().positive(),
  metadata: z.object({
    building_ids: z.array(z.string().min(1)),
    configuration_revision: z.number().int().positive().nullable(),
  }).strict(),
}).strict();

export const weeklySettingsStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  groups: z.array(weeklyReportGroupSchema),
  audit: z.array(weeklySettingsAuditSchema),
}).strict();

export const weeklySettingsMutationSchema = z.object({
  actor_id: z.string().min(1),
  expected_revision: z.number().int().nonnegative(),
  group: weeklySettingsInputSchema,
}).strict();

export const weeklySettingsUpdateSchema = weeklySettingsMutationSchema.extend({
  group_ref: z.string().min(1),
}).strict();

export type WeeklySettingsInput = z.infer<typeof weeklySettingsInputSchema>;
export type WeeklyReportGroup = z.infer<typeof weeklyReportGroupSchema>;
export type WeeklySettingsState = z.infer<typeof weeklySettingsStateSchema>;
export type WeeklyReportRecipients = z.infer<typeof weeklyRecipientsSchema>;
export type WeeklyRecipientRole = z.infer<typeof weeklyRecipientRoleSchema>;
export type WeeklyAutomation = z.infer<typeof weeklyAutomationSchema>;
export type WeeklyReportSectionKey = z.infer<typeof weeklyReportSectionKeySchema>;
