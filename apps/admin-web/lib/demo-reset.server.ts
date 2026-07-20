import { BuildingUpdateIntakeStore } from "./building-updates.server";
import { DemoFileStore, getDemoStore, type DemoRuntimeState } from "./demo-store.server";
import { WeeklySettingsStore } from "./weekly-settings.server";

export interface DemoResetInput {
  actor_id: string;
  expected_revision: number;
  occurred_at?: string;
}

export class DemoResetCoordinator {
  constructor(
    private readonly workflowStore: DemoFileStore = getDemoStore(),
    private readonly intakeStore: BuildingUpdateIntakeStore = new BuildingUpdateIntakeStore(),
    private readonly weeklySettingsStore: WeeklySettingsStore = new WeeklySettingsStore(),
  ) {}

  async reset(input: DemoResetInput): Promise<DemoRuntimeState> {
    const workflowSnapshot = await this.workflowStore.snapshotForDemoReset(input);
    const intakeSnapshot = await this.intakeStore.snapshotForDemoReset();
    const weeklySettingsSnapshot = await this.weeklySettingsStore.snapshotForDemoReset(input.actor_id);

    try {
      const state = await this.workflowStore.reset(input);
      await this.intakeStore.clear();
      await this.weeklySettingsStore.resetForDemo(input.actor_id);
      return state;
    } catch (error) {
      const rollback = await Promise.allSettled([
        this.workflowStore.restoreAfterFailedDemoReset(workflowSnapshot),
        this.intakeStore.restoreAfterFailedDemoReset(intakeSnapshot),
        this.weeklySettingsStore.restoreAfterFailedDemoReset(weeklySettingsSnapshot),
      ]);
      const rollbackErrors = rollback.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], "데모 초기화에 실패했고 이전 상태 복구도 완료하지 못했습니다.");
      }
      throw error;
    }
  }
}
