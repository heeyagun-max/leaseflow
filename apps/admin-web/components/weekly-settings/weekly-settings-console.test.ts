import { describe, expect, it } from "vitest";
import { defaultWeeklyAutomation } from "@/lib/weekly-settings-schema";
import { automationCheckpointRows, editableGroupInput, RecipientsSummary, recipientRows } from "./weekly-settings-console";

const recipients = {
  to: [{ email: "landlord@example.test", role: "to_landlord_practical" as const }],
  cc: [
    { email: "landlord.team@example.test", role: "cc_landlord_team" as const },
    { email: "landlord.exec@example.test", role: "cc_landlord_exec" as const },
    { email: "lm.team@example.test", role: "cc_lm_team" as const },
    { email: "lm.exec@example.test", role: "cc_lm_exec" as const },
  ],
};

describe("weekly settings form helpers", () => {
  it("renders every saved recipient with a plain Korean role label", () => {
    expect(recipientRows(recipients).map(({ label }) => label)).toEqual([
      "임대인 실무 담당",
      "임대인 담당팀",
      "임대인 책임자",
      "임대차 관리팀",
      "임대차 관리 책임자",
    ]);
    const rendered = JSON.stringify(RecipientsSummary({ recipients }));
    expect(rendered).toContain("임대인 실무 담당");
    expect(rendered).toContain("lm.exec@example.test");
  });

  it("submits only editable fields from a detailed group projection", () => {
    const input = editableGroupInput({
      landlord_name: "한빛자산운용",
      building_ids: ["bld-cobalt"],
      cadence: "weekly",
      meeting_weekday: "thursday",
      meeting_time: "15:00",
      next_meeting_on: "2026-07-23",
      owner_user_id: "usr-manager",
      approver_user_id: "usr-lead",
      recipients,
      automation: structuredClone(defaultWeeklyAutomation),
      ...({ ref: "hidden", building_names: ["코발트 센터"] } as object),
    });
    expect(Object.keys(input).sort()).toEqual([
      "approver_user_id", "automation", "building_ids", "cadence", "landlord_name", "meeting_time",
      "meeting_weekday", "next_meeting_on", "owner_user_id", "recipients",
    ]);
    expect(input.recipients).toEqual(recipients);
  });

  it("presents every required automation checkpoint in user language", () => {
    expect(automationCheckpointRows(structuredClone(defaultWeeklyAutomation)).map(({ label, timing }) => `${label} ${timing}`)).toEqual([
      "사전 요약 전 영업일",
      "아침 재집계 보고일",
      "최종 검토 보고일",
      "보고 준비 완료 보고일",
    ]);
  });
});
