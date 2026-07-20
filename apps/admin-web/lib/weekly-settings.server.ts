import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserRole } from "@leaseflow/domain";
import {
  canManageWeeklySettings,
  demoDataDirectory,
  loadWeeklySettingsCatalog,
  type WeeklySettingsCatalog,
} from "./weekly-settings-config.server";
import {
  defaultWeeklyAutomation,
  weeklySettingsInputSchema,
  weeklySettingsStateSchema,
  type WeeklyReportGroup,
  type WeeklyReportRecipients,
  type WeeklySettingsInput,
  type WeeklySettingsState,
} from "./weekly-settings-schema";

export class WeeklySettingsAccessError extends Error {}
export class WeeklySettingsNotFoundError extends Error {}
export class WeeklySettingsValidationError extends Error {}
export class WeeklySettingsRevisionError extends Error {
  constructor(readonly currentRevision: number) {
    super("저장된 내용이 먼저 변경되었습니다. 최신 내용을 다시 불러와 주세요.");
  }
}

export interface ConfiguredWeeklyReportAuthority {
  group_ref: string;
  landlord_name: string;
  building_id: string;
  owner_user_id: string;
  approver_user_id: string;
  configuration_id: string;
  recipients: WeeklyReportRecipients;
  automation: WeeklyReportGroup["automation"];
  settings_revision: number;
  updated_at: string;
  updated_by: string;
}

export interface WeeklySettingsProjection {
  revision: number;
  groups: Array<WeeklyReportGroup & {
    building_names: string[];
    owner_name: string;
    approver_name: string;
    last_changed_by_name: string;
    report_units: Array<{
      building_id: string;
      building_name: string;
      configuration_id: string;
    }>;
  }>;
  change_history: Array<{
    id: string;
    action: "만듦" | "변경" | "초기화";
    actor_name: string;
    group_ref: string | null;
    occurred_at: string;
  }>;
  options: {
    buildings: WeeklySettingsCatalog["buildings"];
    owners: Array<{ id: string; name: string }>;
    approvers: Array<{ id: string; name: string }>;
  };
}

export interface WeeklyOperationalGroupsProjection {
  revision: number;
  can_manage_settings: boolean;
  groups: Array<{
    group_ref: string;
    landlord_name: string;
    cadence: WeeklyReportGroup["cadence"];
    meeting_weekday: WeeklyReportGroup["meeting_weekday"];
    meeting_time: string;
    next_meeting_on: string;
    owner_name: string;
    approver_name: string;
    automation: WeeklyReportGroup["automation"];
    reports: Array<{
      building_id: string;
      building_name: string;
    }>;
  }>;
}

export interface WeeklySettingsStoreOptions {
  statePath?: string;
  seedPath?: string;
  now?: () => Date;
  catalogLoader?: () => Promise<WeeklySettingsCatalog>;
}

const pathLocks = new Map<string, Promise<void>>();

async function withPathLock<T>(statePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = pathLocks.get(statePath) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  pathLocks.set(statePath, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (pathLocks.get(statePath) === tail) pathLocks.delete(statePath);
  }
}

function defaultStatePath() {
  if (process.env.LEASEFLOW_DEMO_STATE_PATH) {
    return path.join(path.dirname(path.resolve(process.env.LEASEFLOW_DEMO_STATE_PATH)), "weekly-settings.v1.json");
  }
  return path.join(demoDataDirectory(), ".runtime/weekly-settings.v1.json");
}

function defaultSeedPath() {
  return path.join(demoDataDirectory(), "report_groups.json");
}

function makeRef(name: string, existing: readonly WeeklyReportGroup[]) {
  const base = name.toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "report-group";
  let ref = base;
  let suffix = 2;
  while (existing.some((group) => group.ref === ref)) ref = `${base}-${suffix++}`;
  return ref;
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function reportConfigurationId(group: WeeklyReportGroup, buildingId: string) {
  return `${group.ref}-${buildingId}-v${group.configuration_revision}`;
}

function auditAction(eventType: WeeklySettingsState["audit"][number]["event_type"]): "만듦" | "변경" | "초기화" {
  if (eventType === "weekly_settings.created") return "만듦";
  if (eventType === "weekly_settings.updated") return "변경";
  return "초기화";
}

function migrateState(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as { revision?: unknown; groups?: unknown; audit?: unknown };
  if (!Array.isArray(candidate.groups)) return value;
  return {
    ...candidate,
    audit: Array.isArray(candidate.audit) ? candidate.audit : [],
    groups: candidate.groups.map((group) => {
      if (!group || typeof group !== "object" || Array.isArray(group)) return group;
      const item = group as Record<string, unknown>;
      const recipients = item.recipients && typeof item.recipients === "object" && !Array.isArray(item.recipients)
        ? item.recipients as { to?: unknown; cc?: unknown }
        : null;
      const legacyTo = recipients && Array.isArray(recipients.to) && recipients.to.every((entry) => typeof entry === "string")
        ? recipients.to as string[]
        : null;
      const legacyCc = recipients && Array.isArray(recipients.cc) && recipients.cc.every((entry) => typeof entry === "string")
        ? recipients.cc as string[]
        : null;
      const migratedRecipients = legacyTo && legacyCc ? {
        to: legacyTo.map((email) => ({ email, role: "to_landlord_practical" })),
        cc: legacyCc.map((email, index) => ({
          email,
          role: ["cc_landlord_team", "cc_landlord_exec", "cc_lm_team", "cc_lm_exec"][index],
        })),
      } : item.recipients;
      return {
        ...item,
        recipients: migratedRecipients,
        automation: item.automation ?? structuredClone(defaultWeeklyAutomation),
        configuration_revision: item.configuration_revision ?? 1,
        updated_by: item.updated_by ?? item.owner_user_id,
      };
    }),
  };
}

export class WeeklySettingsStore {
  private readonly statePath: string;
  private readonly seedPath: string;
  private readonly now: () => Date;
  private readonly catalogLoader: () => Promise<WeeklySettingsCatalog>;

  constructor(options: WeeklySettingsStoreOptions = {}) {
    this.statePath = path.resolve(options.statePath ?? process.env.LEASEFLOW_WEEKLY_SETTINGS_PATH ?? defaultStatePath());
    this.seedPath = path.resolve(options.seedPath ?? defaultSeedPath());
    this.now = options.now ?? (() => new Date());
    this.catalogLoader = options.catalogLoader ?? loadWeeklySettingsCatalog;
  }

  private async readStateUnlocked(): Promise<WeeklySettingsState> {
    try {
      const persisted = JSON.parse(await readFile(this.statePath, "utf8"));
      return weeklySettingsStateSchema.parse(migrateState(persisted));
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
      const seeded = weeklySettingsStateSchema.parse(migrateState(JSON.parse(await readFile(this.seedPath, "utf8"))));
      await this.writeStateUnlocked(seeded);
      return seeded;
    }
  }

  private async writeStateUnlocked(state: WeeklySettingsState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.statePath);
  }

  private validateInput(input: WeeklySettingsInput, catalog: WeeklySettingsCatalog, actorId: string): WeeklySettingsInput {
    const parsed = weeklySettingsInputSchema.parse(input);
    const actor = catalog.users.find((user) => user.id === actorId)!;
    if (!hasUniqueValues(parsed.building_ids)
      || parsed.building_ids.some((id) => !catalog.buildings.some((building) => building.id === id))
      || parsed.building_ids.some((id) => !actor.building_ids.includes(id))) {
      throw new WeeklySettingsValidationError("담당 권한이 있는 건물만 포함할 수 있습니다.");
    }
    const owner = catalog.users.find((user) => user.id === parsed.owner_user_id);
    const approver = catalog.users.find((user) => user.id === parsed.approver_user_id);
    if (!owner || !["lm_manager", "lm_member", "team_lead", "admin"].includes(owner.role)
      || parsed.building_ids.some((id) => !owner.building_ids.includes(id))) {
      throw new WeeklySettingsValidationError("모든 포함 건물을 담당할 수 있는 업무 담당자를 선택해 주세요.");
    }
    if (!approver || approver.role !== "lm_manager"
      || parsed.building_ids.some((id) => !approver.building_ids.includes(id))) {
      throw new WeeklySettingsValidationError("모든 포함 건물을 승인할 수 있는 임대 관리 책임자를 선택해 주세요.");
    }
    const addresses = [...parsed.recipients.to, ...parsed.recipients.cc].map(({ email }) => email);
    const ccRoles = parsed.recipients.cc.map(({ role }) => role);
    const requiredCcRoles = ["cc_landlord_team", "cc_landlord_exec", "cc_lm_team", "cc_lm_exec"];
    if (!hasUniqueValues(addresses) || !hasUniqueValues(ccRoles)
      || requiredCcRoles.some((role) => !ccRoles.includes(role as typeof ccRoles[number]))) {
      throw new WeeklySettingsValidationError("받는 사람과 참조 역할을 각각 한 명씩 중복 없이 지정해 주세요.");
    }
    return parsed;
  }

  private assertActor(actorId: string, catalog: WeeklySettingsCatalog) {
    const actor = catalog.users.find((user) => user.id === actorId);
    if (!actor || !canManageWeeklySettings(actor.role)) {
      throw new WeeklySettingsAccessError("임대 관리 책임자만 주간업무 설정을 관리할 수 있습니다.");
    }
    return actor;
  }

  private resolveDemoActor(actorId: string, catalog: WeeklySettingsCatalog) {
    const actor = catalog.users.find((user) => user.id === actorId);
    if (!actor) throw new WeeklySettingsAccessError("현재 역할을 확인할 수 없습니다.");
    return actor;
  }

  private project(state: WeeklySettingsState, catalog: WeeklySettingsCatalog, actorId: string, groupRef?: string): WeeklySettingsProjection {
    const actor = this.assertActor(actorId, catalog);
    const authorizedGroups = state.groups.filter((group) => group.building_ids.every((id) => actor.building_ids.includes(id)));
    const groups = groupRef ? authorizedGroups.filter((group) => group.ref === groupRef) : authorizedGroups;
    if (groupRef && groups.length === 0) throw new WeeklySettingsNotFoundError("선택한 보고그룹을 찾을 수 없습니다.");
    return {
      revision: state.revision,
      groups: groups.map((group) => ({
        ...group,
        building_names: group.building_ids.map((id) => catalog.buildings.find((building) => building.id === id)?.name ?? "건물 확인 필요"),
        owner_name: catalog.users.find((user) => user.id === group.owner_user_id)?.name ?? "담당자 확인 필요",
        approver_name: catalog.users.find((user) => user.id === group.approver_user_id)?.name ?? "승인자 확인 필요",
        last_changed_by_name: catalog.users.find((user) => user.id === group.updated_by)?.name ?? "담당자 확인 필요",
        report_units: group.building_ids.map((buildingId) => ({
          building_id: buildingId,
          building_name: catalog.buildings.find((building) => building.id === buildingId)?.name ?? "건물 확인 필요",
          configuration_id: reportConfigurationId(group, buildingId),
        })),
      })),
      change_history: state.audit.filter((event) => event.actor_id === actor.id || event.metadata.building_ids.every((id) => actor.building_ids.includes(id))).map((event) => ({
        id: event.id,
        action: auditAction(event.event_type),
        actor_name: catalog.users.find((user) => user.id === event.actor_id)?.name ?? "담당자 확인 필요",
        group_ref: event.group_ref,
        occurred_at: event.occurred_at,
      })),
      options: {
        buildings: catalog.buildings.filter((building) => actor.building_ids.includes(building.id)),
        owners: catalog.users.filter((user) => ["lm_manager", "lm_member", "team_lead", "admin"].includes(user.role)
          && actor.building_ids.some((id) => user.building_ids.includes(id))).map(({ id, name }) => ({ id, name })),
        approvers: catalog.users.filter((user) => user.role === "lm_manager"
          && actor.building_ids.some((id) => user.building_ids.includes(id))).map(({ id, name }) => ({ id, name })),
      },
    };
  }

  async get(actorId: string, groupRef?: string): Promise<WeeklySettingsProjection> {
    const catalog = await this.catalogLoader();
    this.assertActor(actorId, catalog);
    return withPathLock(this.statePath, async () => this.project(await this.readStateUnlocked(), catalog, actorId, groupRef));
  }

  async getAuthorities(): Promise<ConfiguredWeeklyReportAuthority[]> {
    return withPathLock(this.statePath, async () => {
      const state = await this.readStateUnlocked();
      return state.groups.flatMap((group) => group.building_ids.map((buildingId) => ({
        group_ref: group.ref,
        landlord_name: group.landlord_name,
        building_id: buildingId,
        owner_user_id: group.owner_user_id,
        approver_user_id: group.approver_user_id,
        configuration_id: reportConfigurationId(group, buildingId),
        recipients: structuredClone(group.recipients),
        automation: structuredClone(group.automation),
        settings_revision: state.revision,
        updated_at: group.updated_at,
        updated_by: group.updated_by,
      })));
    });
  }

  async getOperationalGroups(actorId: string): Promise<WeeklyOperationalGroupsProjection> {
    const catalog = await this.catalogLoader();
    const actor = catalog.users.find((user) => user.id === actorId);
    if (!actor) throw new WeeklySettingsAccessError("현재 역할을 확인할 수 없습니다.");
    return withPathLock(this.statePath, async () => {
      const state = await this.readStateUnlocked();
      return {
        revision: state.revision,
        can_manage_settings: canManageWeeklySettings(actor.role),
        groups: state.groups.flatMap((group) => {
          const reports = group.building_ids.filter((buildingId) => actor.building_ids.includes(buildingId)).map((buildingId) => ({
            building_id: buildingId,
            building_name: catalog.buildings.find((building) => building.id === buildingId)?.name ?? "건물 확인 필요",
          }));
          return reports.length > 0 ? [{
            group_ref: group.ref,
            landlord_name: group.landlord_name,
            cadence: group.cadence,
            meeting_weekday: group.meeting_weekday,
            meeting_time: group.meeting_time,
            next_meeting_on: group.next_meeting_on,
            owner_name: catalog.users.find((user) => user.id === group.owner_user_id)?.name ?? "담당자 확인 필요",
            approver_name: catalog.users.find((user) => user.id === group.approver_user_id)?.name ?? "승인자 확인 필요",
            automation: structuredClone(group.automation),
            reports,
          }] : [];
        }),
      };
    });
  }

  async create(actorId: string, expectedRevision: number, input: WeeklySettingsInput) {
    const catalog = await this.catalogLoader();
    const actor = this.assertActor(actorId, catalog);
    return withPathLock(this.statePath, async () => {
      const state = await this.readStateUnlocked();
      if (state.revision !== expectedRevision) throw new WeeklySettingsRevisionError(state.revision);
      const parsed = this.validateInput(input, catalog, actorId);
      if (parsed.building_ids.some((buildingId) => state.groups.some((group) => group.building_ids.includes(buildingId)))) {
        throw new WeeklySettingsValidationError("한 건물은 하나의 임대인 보고그룹에만 포함할 수 있습니다.");
      }
      const occurredAt = this.now().toISOString();
      const group: WeeklyReportGroup = {
        ...parsed,
        ref: makeRef(parsed.landlord_name, state.groups),
        report_scope: "building_specific",
        configuration_revision: 1,
        updated_by: actor.id,
        updated_at: occurredAt,
      };
      const revision = state.revision + 1;
      const next: WeeklySettingsState = {
        revision,
        groups: [...state.groups, group],
        audit: [...state.audit, {
          id: `weekly-settings-audit-${state.audit.length + 1}`,
          event_type: "weekly_settings.created",
          actor_id: actor.id,
          actor_role: actor.role,
          group_ref: group.ref,
          occurred_at: occurredAt,
          revision,
          metadata: { building_ids: [...group.building_ids], configuration_revision: group.configuration_revision },
        }],
      };
      await this.writeStateUnlocked(next);
      return this.project(next, catalog, actorId, group.ref);
    });
  }

  async update(actorId: string, expectedRevision: number, groupRef: string, input: WeeklySettingsInput) {
    const catalog = await this.catalogLoader();
    const actor = this.assertActor(actorId, catalog);
    return withPathLock(this.statePath, async () => {
      const state = await this.readStateUnlocked();
      if (state.revision !== expectedRevision) throw new WeeklySettingsRevisionError(state.revision);
      const index = state.groups.findIndex((group) => group.ref === groupRef);
      if (index < 0) throw new WeeklySettingsNotFoundError("선택한 보고그룹을 찾을 수 없습니다.");
      const current = state.groups[index]!;
      if (current.building_ids.some((id) => !actor.building_ids.includes(id))) {
        throw new WeeklySettingsAccessError("담당 권한이 있는 보고그룹만 변경할 수 있습니다.");
      }
      const parsed = this.validateInput(input, catalog, actorId);
      if (parsed.building_ids.some((buildingId) => state.groups.some((group, groupIndex) => groupIndex !== index && group.building_ids.includes(buildingId)))) {
        throw new WeeklySettingsValidationError("한 건물은 하나의 임대인 보고그룹에만 포함할 수 있습니다.");
      }
      const occurredAt = this.now().toISOString();
      const updated: WeeklyReportGroup = {
        ...parsed,
        ref: current.ref,
        report_scope: "building_specific",
        configuration_revision: current.configuration_revision + 1,
        updated_by: actor.id,
        updated_at: occurredAt,
      };
      const groups = [...state.groups];
      groups[index] = updated;
      const revision = state.revision + 1;
      const next: WeeklySettingsState = {
        revision,
        groups,
        audit: [...state.audit, {
          id: `weekly-settings-audit-${state.audit.length + 1}`,
          event_type: "weekly_settings.updated",
          actor_id: actor.id,
          actor_role: actor.role,
          group_ref: groupRef,
          occurred_at: occurredAt,
          revision,
          metadata: { building_ids: [...updated.building_ids], configuration_revision: updated.configuration_revision },
        }],
      };
      await this.writeStateUnlocked(next);
      return this.project(next, catalog, actorId, groupRef);
    });
  }

  async resetForDemo(actorId: string): Promise<WeeklySettingsState> {
    const catalog = await this.catalogLoader();
    const actor = this.resolveDemoActor(actorId, catalog);
    return withPathLock(this.statePath, async () => {
      const current = await this.readStateUnlocked();
      const seed = weeklySettingsStateSchema.parse(migrateState(JSON.parse(await readFile(this.seedPath, "utf8"))));
      const revision = current.revision + 1;
      const reset: WeeklySettingsState = {
        revision,
        groups: seed.groups,
        audit: [...current.audit, {
          id: `weekly-settings-audit-${current.audit.length + 1}`,
          event_type: "weekly_settings.reset",
          actor_id: actor.id,
          actor_role: actor.role,
          group_ref: null,
          occurred_at: this.now().toISOString(),
          revision,
          metadata: {
            building_ids: [...new Set(seed.groups.flatMap((group) => group.building_ids))],
            configuration_revision: null,
          },
        }],
      };
      await this.writeStateUnlocked(reset);
      return reset;
    });
  }

  async resetToSeed(actorId = "usr-manager"): Promise<WeeklySettingsState> {
    return this.resetForDemo(actorId);
  }

  async snapshotForDemoReset(actorId: string): Promise<WeeklySettingsState> {
    const catalog = await this.catalogLoader();
    this.resolveDemoActor(actorId, catalog);
    return withPathLock(this.statePath, async () => structuredClone(await this.readStateUnlocked()));
  }

  async restoreAfterFailedDemoReset(snapshot: WeeklySettingsState): Promise<void> {
    return withPathLock(this.statePath, async () => {
      await this.writeStateUnlocked(weeklySettingsStateSchema.parse(structuredClone(snapshot)));
    });
  }
}

export async function loadWeeklyReportAuthorities(): Promise<ConfiguredWeeklyReportAuthority[]> {
  return new WeeklySettingsStore().getAuthorities();
}
