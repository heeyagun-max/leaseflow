"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminData } from "@/components/governance/admin-data";
import {
  defaultWeeklyAutomation,
  weeklyReportSectionKeySchema,
  weeklyReportSectionLabels,
  type WeeklyRecipientRole,
  type WeeklyReportSectionKey,
  type WeeklySettingsInput,
} from "@/lib/weekly-settings-schema";
import styles from "./weekly-settings.module.css";

type Mode = "list" | "create" | "edit";
type Group = WeeklySettingsInput & {
  ref: string;
  report_scope: "building_specific";
  updated_at: string;
  building_names: string[];
  owner_name: string;
  approver_name: string;
};
type Projection = {
  revision: number;
  groups: Group[];
  options: {
    buildings: Array<{ id: string; name: string }>;
    owners: Array<{ id: string; name: string }>;
    approvers: Array<{ id: string; name: string }>;
  };
};

const cadenceLabels = { weekly: "매주", biweekly: "격주", monthly: "매월" } as const;
const weekdayLabels = { monday: "월요일", tuesday: "화요일", wednesday: "수요일", thursday: "목요일", friday: "금요일" } as const;
export const recipientLabels: Record<WeeklyRecipientRole, string> = {
  to_landlord_practical: "임대인 실무 담당",
  cc_landlord_team: "임대인 담당팀",
  cc_landlord_exec: "임대인 책임자",
  cc_lm_team: "임대차 관리팀",
  cc_lm_exec: "임대차 관리 책임자",
};

const ccRoles = [
  "cc_landlord_team",
  "cc_landlord_exec",
  "cc_lm_team",
  "cc_lm_exec",
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00+09:00`));
}

function emptyInput(): WeeklySettingsInput {
  return {
    landlord_name: "",
    building_ids: [],
    cadence: "weekly",
    meeting_weekday: "thursday",
    meeting_time: "15:00",
    next_meeting_on: "",
    owner_user_id: "",
    approver_user_id: "",
    recipients: {
      to: [{ email: "", role: "to_landlord_practical" }],
      cc: ccRoles.map((role) => ({ email: "", role })),
    },
    automation: structuredClone(defaultWeeklyAutomation),
  };
}

export function editableGroupInput(group: WeeklySettingsInput): WeeklySettingsInput {
  return {
    landlord_name: group.landlord_name,
    building_ids: [...group.building_ids],
    cadence: group.cadence,
    meeting_weekday: group.meeting_weekday,
    meeting_time: group.meeting_time,
    next_meeting_on: group.next_meeting_on,
    owner_user_id: group.owner_user_id,
    approver_user_id: group.approver_user_id,
    recipients: {
      to: group.recipients.to.map((recipient) => ({ ...recipient })),
      cc: group.recipients.cc.map((recipient) => ({ ...recipient })),
    },
    automation: structuredClone(group.automation),
  };
}

export function automationCheckpointRows(automation: WeeklySettingsInput["automation"]) {
  return [
    { key: "pre_summary_time", label: "사전 요약", timing: "전 영업일", time: automation.checkpoints.pre_summary_time },
    { key: "morning_refresh_time", label: "아침 재집계", timing: "보고일", time: automation.checkpoints.morning_refresh_time },
    { key: "final_review_time", label: "최종 검토", timing: "보고일", time: automation.checkpoints.final_review_time },
    { key: "delivery_time", label: "보고 준비 완료", timing: "보고일", time: automation.checkpoints.delivery_time },
  ] as const;
}

export function recipientRows(recipients: WeeklySettingsInput["recipients"]) {
  return [...recipients.to, ...recipients.cc].map((recipient) => ({
    role: recipient.role,
    label: recipientLabels[recipient.role],
    email: recipient.email,
  }));
}

export function RecipientsSummary({ recipients }: { recipients: WeeklySettingsInput["recipients"] }) {
  return <dl className={`${styles.facts} ${styles.recipients}`}>{recipientRows(recipients).map((recipient) => <div key={recipient.role}><dt>{recipient.label}</dt><dd>{recipient.email}</dd></div>)}</dl>;
}

export function WeeklySettingsConsole({ groupRef, mode }: { groupRef?: string; mode: Mode }) {
  const { actorId, workflow } = useAdminData();
  const router = useRouter();
  const [projection, setProjection] = useState<Projection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = workflow?.canViewSettings ?? false;

  async function load() {
    if (!canManage) return;
    setError(null);
    const query = new URLSearchParams({ actor_id: actorId });
    if (groupRef) query.set("group_ref", groupRef);
    try {
      const response = await fetch(`/api/weekly-settings?${query}`, { cache: "no-store" });
      const result = await response.json() as Projection & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setProjection(result);
    } catch (loadError) {
      setProjection(null);
      setError(loadError instanceof Error ? loadError.message : "주간 보고 설정을 불러오지 못했습니다.");
    }
  }

  useEffect(() => { void load(); }, [actorId, canManage, groupRef]);

  if (!workflow) return <LoadingState />;
  if (!canManage) return <PermissionState />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  if (!projection) return <LoadingState />;
  if (mode === "list") return <SettingsList projection={projection} />;
  const group = mode === "edit" ? projection.groups[0] : undefined;
  if (mode === "edit" && !group) return <ErrorState message="선택한 보고그룹을 찾을 수 없습니다." />;

  async function save(input: WeeklySettingsInput) {
    if (!projection || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/weekly-settings", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor_id: actorId,
          expected_revision: projection.revision,
          ...(mode === "edit" ? { group_ref: groupRef } : {}),
          group: input,
        }),
      });
      const result = await response.json() as Projection & { error?: string };
      if (!response.ok) throw new Error(result.error);
      const saved = result.groups[0];
      if (!saved) throw new Error("저장된 보고그룹을 다시 불러오지 못했습니다.");
      if (mode === "create") {
        router.replace(`/weekly-settings/${encodeURIComponent(saved.ref)}`);
        return;
      }
      setProjection(result);
      setNotice("주간 보고 설정을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "주간 보고 설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return <SettingsForm {...(group ? { group } : {})} mode={mode} notice={notice} options={projection.options} saving={saving} save={save} />;
}

function PageHeader({ action, title }: { action?: React.ReactNode; title: string }) {
  return <header className={styles.header}><h1 tabIndex={-1}>{title}</h1>{action}</header>;
}

function SettingsList({ projection }: { projection: Projection }) {
  return <>
    <PageHeader title="Report Automation" action={<div className={styles.headerActions}><Link className="lf-admin-button lf-admin-button--secondary" href="/weekly">Weekly Reports</Link><Link className="lf-admin-button" href="/weekly-settings/new">Add Automation</Link></div>} />
    <section aria-labelledby="weekly-groups-heading">
      <div className="lf-admin-section-heading"><h2 id="weekly-groups-heading">임대인 보고그룹</h2><span>{projection.groups.length}개</span></div>
      {projection.groups.length ? <ul className={styles.list}>{projection.groups.map((group) => <li className={styles.item} key={group.ref}>
        <Link href={`/weekly-settings/${encodeURIComponent(group.ref)}`}>
          <div><h2>{group.landlord_name}</h2><p>{group.building_names.join(" · ")}</p></div>
          <dl className={styles.facts}><div><dt>미팅 주기</dt><dd>{cadenceLabels[group.cadence]} · {weekdayLabels[group.meeting_weekday]} {group.meeting_time}</dd></div><div><dt>다음 미팅</dt><dd>{formatDate(group.next_meeting_on)}</dd></div><div><dt>필수 내용</dt><dd>{group.automation.required_section_keys.length}개</dd></div><div><dt>집계 기간</dt><dd>최근 {group.automation.aggregation_days}일</dd></div><div><dt>업무 담당</dt><dd>{group.owner_name}</dd></div><div><dt>최종 승인</dt><dd>{group.approver_name}</dd></div></dl>
          <RecipientsSummary recipients={group.recipients} />
        </Link>
      </li>)}</ul> : <div className={styles.empty}><h2>등록된 보고그룹이 없습니다</h2><p>첫 임대인 보고그룹을 만들고 미팅 준비 기준을 저장해 주세요.</p></div>}
    </section>
  </>;
}

function SettingsForm({ group, mode, notice, options, save, saving }: {
  group?: Group;
  mode: "create" | "edit";
  notice: string | null;
  options: Projection["options"];
  save: (input: WeeklySettingsInput) => Promise<void>;
  saving: boolean;
}) {
  const initial = useMemo(() => group ? editableGroupInput(group) : emptyInput(), [group]);
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(form);
  }

  function setRecipientEmail(role: WeeklyRecipientRole, email: string) {
    if (role === "to_landlord_practical") {
      setForm({ ...form, recipients: { ...form.recipients, to: [{ email, role }] } });
      return;
    }
    setForm({
      ...form,
      recipients: {
        ...form.recipients,
        cc: form.recipients.cc.map((recipient) => recipient.role === role ? { ...recipient, email } : recipient),
      },
    });
  }

  let submitLabel = mode === "create" ? "자동화 저장" : "변경 내용 저장";
  if (saving) submitLabel = "저장 중…";

  return <>
    <PageHeader title={mode === "create" ? "Add Report Automation" : `${group!.landlord_name} Settings`} action={<Link className="lf-admin-button lf-admin-button--secondary" href="/weekly">Weekly Reports</Link>} />
    {notice ? <div className={styles.notice} role="status"><h2>저장 완료</h2><p>{notice}</p></div> : null}
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.section} aria-labelledby="group-basic-heading"><h2 id="group-basic-heading">임대인과 포함 건물</h2><div className={styles.grid}>
        <label className={styles.field}><span>임대인</span><input required maxLength={80} value={form.landlord_name} onChange={(event) => setForm({ ...form, landlord_name: event.target.value })} /></label>
        <fieldset className={styles.buildings}><legend>함께 준비할 건물</legend>{options.buildings.map((building) => <label key={building.id}><input type="checkbox" checked={form.building_ids.includes(building.id)} onChange={(event) => setForm({ ...form, building_ids: event.target.checked ? [...form.building_ids, building.id] : form.building_ids.filter((id) => id !== building.id) })} />{building.name}</label>)}</fieldset>
      </div></section>
      <section className={styles.section} aria-labelledby="meeting-heading"><h2 id="meeting-heading">미팅 일정</h2><div className={styles.grid}>
        <label className={styles.field}><span>미팅 주기</span><select value={form.cadence} onChange={(event) => setForm({ ...form, cadence: event.target.value as WeeklySettingsInput["cadence"] })}>{Object.entries(cadenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={styles.field}><span>미팅 요일</span><select value={form.meeting_weekday} onChange={(event) => setForm({ ...form, meeting_weekday: event.target.value as WeeklySettingsInput["meeting_weekday"] })}>{Object.entries(weekdayLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={styles.field}><span>미팅 시간</span><input required type="time" value={form.meeting_time} onChange={(event) => setForm({ ...form, meeting_time: event.target.value })} /></label>
        <label className={styles.field}><span>다음 미팅 날짜</span><input required type="date" value={form.next_meeting_on} onChange={(event) => setForm({ ...form, next_meeting_on: event.target.value })} /></label>
      </div></section>
      <section className={styles.section} aria-labelledby="automation-heading"><h2 id="automation-heading">자동화 일정</h2><div className={styles.grid}>
        <label className={styles.field}><span>활동 집계 기간</span><select value={form.automation.aggregation_days} onChange={(event) => setForm({ ...form, automation: { ...form.automation, aggregation_days: Number(event.target.value) as WeeklySettingsInput["automation"]["aggregation_days"] } })}><option value={7}>최근 7일</option><option value={14}>최근 14일</option><option value={30}>최근 30일</option></select></label>
        <div className={styles.checkpoints}>{automationCheckpointRows(form.automation).map((checkpoint) => <label className={styles.field} key={checkpoint.key}><span>{checkpoint.label} · {checkpoint.timing}</span><input required type="time" value={checkpoint.time} onChange={(event) => setForm({ ...form, automation: { ...form.automation, checkpoints: { ...form.automation.checkpoints, [checkpoint.key]: event.target.value } } })} /></label>)}</div>
      </div></section>
      <section className={styles.section} aria-labelledby="report-content-heading"><div className={styles.sectionHeading}><h2 id="report-content-heading">보고 필수 내용</h2><span>{form.automation.required_section_keys.length}개 선택</span></div><fieldset className={styles.reportSections}><legend className="lf-visually-hidden">보고에 포함할 필수 내용</legend>{weeklyReportSectionKeySchema.options.map((sectionKey) => <label key={sectionKey}><input type="checkbox" checked={form.automation.required_section_keys.includes(sectionKey)} onChange={(event) => {
        const nextKeys = event.target.checked
          ? [...form.automation.required_section_keys, sectionKey]
          : form.automation.required_section_keys.filter((key) => key !== sectionKey);
        setForm({ ...form, automation: { ...form.automation, required_section_keys: nextKeys as WeeklyReportSectionKey[] } });
      }} />{weeklyReportSectionLabels[sectionKey]}</label>)}</fieldset><div className={styles.alwaysIncluded}><span>항상 포함</span><strong>보고 기간 · 근거 · 첨부 자료</strong></div></section>
      <section className={styles.section} aria-labelledby="people-heading"><h2 id="people-heading">담당자와 승인자</h2><div className={styles.grid}>
        <label className={styles.field}><span>업무 담당</span><select required value={form.owner_user_id} onChange={(event) => setForm({ ...form, owner_user_id: event.target.value })}><option value="">선택해 주세요</option>{options.owners.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label className={styles.field}><span>최종 승인</span><select required value={form.approver_user_id} onChange={(event) => setForm({ ...form, approver_user_id: event.target.value })}><option value="">선택해 주세요</option>{options.approvers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      </div></section>
      <section className={styles.section} aria-labelledby="recipients-heading"><h2 id="recipients-heading">보고 수신자</h2><div className={styles.recipientGrid}>
        {recipientRows(form.recipients).map((recipient) => {
          return <label className={styles.field} key={recipient.role}><span>{recipient.label}</span><input required type="email" value={recipient.email} onChange={(event) => setRecipientEmail(recipient.role, event.target.value)} placeholder="name@example.test" /></label>;
        })}
      </div></section>
      <div className={styles.actions}><button className="lf-admin-button" disabled={saving || form.automation.required_section_keys.length === 0} type="submit">{submitLabel}</button><Link className="lf-admin-button lf-admin-button--secondary" href="/weekly-settings">설정 목록으로</Link></div>
    </form>
  </>;
}

function LoadingState() {
  return <><PageHeader title="Report Automation" /><div className="lf-admin-skeleton" aria-busy="true"><span /><span /><span /></div></>;
}

function PermissionState() {
  return <><PageHeader title="Report Automation" /><section className={styles.error} aria-labelledby="weekly-permission-heading"><h2 id="weekly-permission-heading">You do not have permission to manage this configuration.</h2><p>Only leasing managers can change report groups, meeting schedules, recipients, and approvers.</p></section></>;
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <><PageHeader title="Report Automation" /><section className={styles.error} aria-labelledby="weekly-error-heading"><h2 id="weekly-error-heading">Configuration could not be opened.</h2><p>{message}</p>{retry ? <div className={styles.actions}><button className="lf-admin-button" onClick={retry} type="button">Try again</button></div> : null}</section></>;
}
