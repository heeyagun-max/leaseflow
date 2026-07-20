import { readFile } from "node:fs/promises";
import path from "node:path";
import { BuildingUpdateIntakeStore } from "./building-updates.server";
import { getDemoStore, type DemoFileStore } from "./demo-store.server";
import { loadOperationsSnapshotPublic } from "./operations-snapshot-public.server";

export interface CurrentBuildingSourceFile {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

function repositoryRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
}

export async function loadCurrentBuildingSourceFile(
  actorId: string,
  buildingId: string,
  workflowStore: Pick<DemoFileStore, "getState"> = getDemoStore(),
  intakeStore = new BuildingUpdateIntakeStore(),
): Promise<CurrentBuildingSourceFile> {
  const snapshot = await loadOperationsSnapshotPublic(actorId, workflowStore);
  if (!snapshot.scope.building_ids.includes(buildingId) || snapshot.published.building_id !== buildingId) {
    throw new Error("현재 역할로 이 건물의 원본 자료를 볼 수 없습니다.");
  }

  const [state, intake] = await Promise.all([workflowStore.getState(), intakeStore.get()]);
  if (state.stage !== "published" || !intake?.uploaded_file || intake.document_asset_id) {
    throw new Error("현재 게시 정보에 연결된 원본 자료가 없습니다.");
  }
  if (intake.building_id && intake.building_id !== buildingId) {
    throw new Error("현재 게시 정보와 원본 자료의 건물이 일치하지 않습니다.");
  }

  try {
    return {
      bytes: await intakeStore.readUploadedFile(intake.uploaded_file.stored_filename),
      filename: intake.uploaded_file.original_filename,
      mimeType: intake.uploaded_file.mime_type,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT"
      || intake.uploaded_file.original_filename !== "source_update.json") {
      throw error;
    }
    return {
      bytes: await readFile(path.join(repositoryRoot(), "data/demo/source_update.json")),
      filename: intake.uploaded_file.original_filename,
      mimeType: intake.uploaded_file.mime_type,
    };
  }
}
