import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoFileStore } from "./demo-store.server";
import {
  BuildingUpdateIntakeStore,
  BuildingUpdateService,
  canAccessBuildingUpdates,
  canRunBuildingUpdateAction,
  parseBuildingUpdateRegistration,
  parseBuildingUpdateUploadRegistration,
} from "./building-updates.server";
import { createBuildingUpdateHandlers } from "./building-updates-route.server";

const temporaryDirectories: string[] = [];
const fixtureEncoder = new TextEncoder();
const DWG_GUIDANCE = "DWG는 자동으로 분석할 수 없습니다. PDF 변환본을 올리거나 수동 검토로 등록해 주세요.";

function concatFixtureBytes(...parts: Uint8Array[]) {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return bytes;
}

function fixtureUint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function fixtureUint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function fixtureCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function syntheticOfficeZip(entries: Record<string, string>) {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = fixtureEncoder.encode(name);
    const data = fixtureEncoder.encode(content);
    const checksum = fixtureCrc32(data);
    const local = concatFixtureBytes(
      fixtureUint32(0x04034b50), fixtureUint16(20), fixtureUint16(0), fixtureUint16(0), fixtureUint16(0), fixtureUint16(0),
      fixtureUint32(checksum), fixtureUint32(data.byteLength), fixtureUint32(data.byteLength), fixtureUint16(nameBytes.byteLength), fixtureUint16(0),
      nameBytes, data,
    );
    locals.push(local);
    central.push(concatFixtureBytes(
      fixtureUint32(0x02014b50), fixtureUint16(20), fixtureUint16(20), fixtureUint16(0), fixtureUint16(0), fixtureUint16(0), fixtureUint16(0),
      fixtureUint32(checksum), fixtureUint32(data.byteLength), fixtureUint32(data.byteLength), fixtureUint16(nameBytes.byteLength),
      fixtureUint16(0), fixtureUint16(0), fixtureUint16(0), fixtureUint16(0), fixtureUint32(0), fixtureUint32(offset), nameBytes,
    ));
    offset += local.byteLength;
  }
  const centralBytes = concatFixtureBytes(...central);
  return concatFixtureBytes(
    ...locals, centralBytes,
    fixtureUint32(0x06054b50), fixtureUint16(0), fixtureUint16(0), fixtureUint16(central.length), fixtureUint16(central.length),
    fixtureUint32(centralBytes.byteLength), fixtureUint32(offset), fixtureUint16(0),
  );
}

function syntheticPdfFixture(text = "LeaseFlow synthetic floor plan") {
  const stream = text
    ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
    : "q 1 0 0 1 0 0 cm Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(fixtureEncoder.encode(body).byteLength);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = fixtureEncoder.encode(body).byteLength;
  const xref = offsets.map((offset, index) => index === 0
    ? "0000000000 65535 f \n"
    : `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return fixtureEncoder.encode(`${body}xref\n0 ${offsets.length}\n${xref}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
}

function syntheticXlsxFixture() {
  return syntheticOfficeZip({
    "[Content_Types].xml": "<Types><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/></Types>",
    "xl/workbook.xml": "<workbook><sheets><sheet name=\"Available Areas\"/></sheets></workbook>",
    "xl/worksheets/sheet1.xml": "<worksheet><sheetData><row><c><v>LeaseFlow synthetic area</v></c></row></sheetData></worksheet>",
  });
}

function syntheticDocxFixture() {
  return syntheticOfficeZip({
    "[Content_Types].xml": "<Types><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>",
    "word/document.xml": "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>LeaseFlow synthetic legal update</w:t></w:r></w:p></w:body></w:document>",
  });
}

function uploadedSourceForm(
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
  documentType: string,
  building = { id: "bld-cobalt", name: "Cobalt Finance Center" },
  expectedVersion = 0,
) {
  const form = new FormData();
  form.set("actor_id", "usr-junior");
  form.set("expected_version", String(expectedVersion));
  form.set("building_id", building.id);
  form.set("building_name", building.name);
  form.set("document_type", documentType);
  form.set("file", new File([Uint8Array.from(bytes).buffer], filename, { type: mimeType }));
  return form;
}

function officialPropertyState(state: Awaited<ReturnType<DemoFileStore["getState"]>>) {
  return {
    source_id: state.source_id,
    effective_date: state.effective_date,
    publication_scope: state.publication_scope,
    stage: state.stage,
    candidates: state.candidates,
    records: state.records,
    files: state.files,
    audit: state.audit,
  };
}

async function createService() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "leaseflow-building-update-"));
  temporaryDirectories.push(directory);
  return new BuildingUpdateService(
    new DemoFileStore(path.join(directory, "workflow.json")),
    new BuildingUpdateIntakeStore(path.join(directory, "intake.json")),
  );
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("building update registration", () => {
  it("keeps intake state beside the configured demo workflow state", () => {
    const directory = path.join(os.tmpdir(), "leaseflow-configured-runtime");
    vi.stubEnv("LEASEFLOW_DEMO_STATE_PATH", path.join(directory, "state.v1.json"));

    expect(new BuildingUpdateIntakeStore().storePath).toBe(path.join(directory, "building-updates.v1.json"));
  });

  it("maps only the approved synthetic form values", () => {
    expect(parseBuildingUpdateRegistration({
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    })).toMatchObject({ selected_file: "july-building-update", effective_date: "2026-07-18" });

    expect(() => parseBuildingUpdateRegistration({
      selected_file: "private-owner-file.pdf",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    })).toThrow();
    expect(() => parseBuildingUpdateRegistration({
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-19",
      building_name: "Cobalt Finance Center",
    })).toThrow();
  });

  it("accepts the building and document type selected for an uploaded source", () => {
    expect(parseBuildingUpdateUploadRegistration({
      building_id: "bld-cobalt",
      building_name: "Cobalt Finance Center",
      document_type: "monthly_owner_update",
    })).toEqual({
      building_id: "bld-cobalt",
      building_name: "Cobalt Finance Center",
      document_type: "monthly_owner_update",
    });

    expect(parseBuildingUpdateUploadRegistration({
      building_id: "bld-teheran-link",
      building_name: "Teheran Link",
      document_type: "leasing_flyer",
    })).toEqual({
      building_id: "bld-teheran-link",
      building_name: "Teheran Link",
      document_type: "leasing_flyer",
    });

    expect(() => parseBuildingUpdateUploadRegistration({
      building_id: "bld-cobalt",
      building_name: "Unknown Building",
      document_type: "monthly_owner_update",
    })).toThrow();

    expect(() => parseBuildingUpdateUploadRegistration({
      building_id: "bld-pacific-gate",
      building_name: "Cobalt Finance Center",
      document_type: "monthly_owner_update",
    })).toThrow();
  });

  it("keeps access and decisions separated by role", () => {
    expect(canAccessBuildingUpdates("data_steward")).toBe(true);
    expect(canAccessBuildingUpdates("senior_reviewer")).toBe(true);
    expect(canAccessBuildingUpdates("lm_manager")).toBe(false);
    expect(canRunBuildingUpdateAction("data_steward", "register")).toBe(true);
    expect(canRunBuildingUpdateAction("data_steward", "confirm")).toBe(true);
    expect(canRunBuildingUpdateAction("data_steward", "publish")).toBe(false);
    expect(canRunBuildingUpdateAction("senior_reviewer", "publish")).toBe(true);
  });
});

describe("building update publication boundary", () => {
  it("does not advance the workflow when the intake record cannot be persisted", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    vi.spyOn(service.intakeStore, "save").mockRejectedValueOnce(new Error("intake write failed"));

    await expect(service.register("usr-junior", 0, {
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    })).rejects.toThrow("intake write failed");

    await expect(service.workflowStore.getState()).resolves.toMatchObject({ revision: 0, stage: "source_uploaded" });
  });

  it("keeps a reconstructible intake record when extraction persistence fails", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    vi.spyOn(service.workflowStore, "extract").mockRejectedValueOnce(new Error("workflow write failed"));

    await expect(service.register("usr-junior", 0, {
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    }, "2026-07-19T01:00:00.000Z")).rejects.toThrow("workflow write failed");

    await expect(service.intakeStore.get()).resolves.toMatchObject({
      update_ref: "cobalt-2026-07-18",
      registered_at: "2026-07-19T01:00:00.000Z",
    });
    await expect(service.workflowStore.getState()).resolves.toMatchObject({ revision: 0, stage: "source_uploaded" });
  });

  it("returns to the upload step after reset even when the prior intake record remains", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const initial = await service.projection("usr-junior");
    const extracted = await service.register("usr-junior", initial.version, {
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    }, "2026-07-19T01:00:00.000Z");

    await service.workflowStore.reset({
      actor_id: "usr-manager",
      expected_revision: extracted.revision,
      occurred_at: "2026-07-19T02:00:00.000Z",
    });

    expect(await service.intakeStore.get()).not.toBeNull();
    await expect(service.projection("usr-junior")).resolves.toMatchObject({ step: "자료 올리기" });
  });

  it("does not propagate reviewed changes until final publication", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const initial = await service.projection("usr-junior", new Date("2026-07-19T00:00:00.000Z"));
    expect(initial.step).toBe("자료 올리기");
    expect(initial.currentFacts).toContainEqual(expect.objectContaining({ label: "전용면적", value: "300평" }));

    await service.register("usr-junior", initial.version, {
      selected_file: "july-building-update",
      source_organization: "Synthetic Asset Management",
      effective_date: "2026-07-18",
      building_name: "Cobalt Finance Center",
    }, "2026-07-19T01:00:00.000Z");
    const compared = await service.projection("usr-junior", new Date("2026-07-19T02:00:00.000Z"));
    expect(compared.step).toBe("변경 확인");
    expect(compared.changes).toContainEqual({ label: "전용면적", before: "300평", after: "200평" });
    expect(compared.currentFacts).toContainEqual(expect.objectContaining({ label: "전용면적", value: "300평" }));

    await service.confirm("usr-junior", compared.version, "2026-07-19T03:00:00.000Z");
    const confirmed = await service.projection("usr-senior", new Date("2026-07-19T04:00:00.000Z"));
    expect(confirmed.step).toBe("최종 확인");
    expect(confirmed.currentFacts).toContainEqual(expect.objectContaining({ label: "전용면적", value: "300평" }));

    await service.publish("usr-senior", confirmed.version, "2026-07-19T05:00:00.000Z");
    const published = await service.projection("usr-senior", new Date("2026-07-19T06:00:00.000Z"));
    expect(published.step).toBe("최신정보 반영");
    expect(published.currentFacts).toContainEqual(expect.objectContaining({ label: "전용면적", value: "200평" }));
    expect(published.currentFiles).toContainEqual(expect.objectContaining({ filename: "CFC_5F_plan_v2.svg" }));
    expect(published.history).toEqual(expect.arrayContaining([
      expect.objectContaining({ buildingName: "Cobalt Finance Center", label: "전용면적", value: "300평", updatedAt: "2026-06-01", current: false }),
      expect.objectContaining({ buildingName: "Cobalt Finance Center", label: "전용면적", value: "200평", updatedAt: "2026-07-18", current: true }),
    ]));
  });

  it("enforces the role gate in the HTTP handlers", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const handlers = createBuildingUpdateHandlers(await createService());
    const denied = await handlers.get(new Request("http://localhost/api/building-updates?actor_id=usr-manager"));
    expect(denied.status).toBe(403);
    expect(await denied.json()).toEqual({ error: "현재 역할로 이 작업을 진행할 수 없습니다." });

    const invalid = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register", actor_id: "usr-junior", expected_version: 0,
        registration: { selected_file: "unknown", source_organization: "Synthetic Asset Management", effective_date: "2026-07-18", building_name: "Cobalt Finance Center" },
      }),
    }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "입력한 자료 정보를 다시 확인해 주세요." });
  });

  it("stores and analyzes the actual uploaded synthetic document", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const repository = path.basename(process.cwd()) === "admin-web" ? path.resolve(process.cwd(), "../..") : process.cwd();
    const sourceBytes = await readFile(path.join(repository, "data/demo/source_update.json"));
    const form = new FormData();
    form.set("actor_id", "usr-junior");
    form.set("expected_version", "0");
    form.set("building_name", "Cobalt Finance Center");
    form.set("document_type", "monthly_owner_update");
    form.set("file", new File([sourceBytes], "source_update.json", { type: "application/json" }));

    const response = await handlers.post(new Request("http://localhost/api/building-updates", { method: "POST", body: form }));
    expect(response.status).toBe(200);
    const projection = await response.json();
    expect(projection).toMatchObject({
      step: "변경 확인",
      documentType: "monthly_owner_update",
      selectedFile: { key: "july-building-update", filename: "source_update.json", label: "7월 건물정보 변경 자료" },
      uploadedFile: { original_filename: "source_update.json", byte_size: sourceBytes.byteLength },
      analysis: { status: "candidate_ready", candidate_count: 4 },
    });
    expect(projection.selectedFile).not.toHaveProperty("repositoryPath");
    expect(projection.changes).toContainEqual({ label: "전용면적", before: "300평", after: "200평" });

    const intake = await service.intakeStore.get();
    expect(intake?.uploaded_file?.stored_filename).toMatch(/^[a-f0-9]{12}-source_update\.json$/);
    await expect(stat(path.join(path.dirname(service.intakeStore.storePath), "building-update-files", intake!.uploaded_file!.stored_filename))).resolves.toMatchObject({ size: sourceBytes.byteLength });
  });
});

describe("building update real-source intake boundary", () => {
  it("registers a governed reference document without changing the official four-field state", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();
    const bytes = syntheticPdfFixture();

    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_Cobalt_leasing_flyer_202607.pdf", "application/pdf", bytes, "leasing_flyer"),
    }));
    const projection = await response.json() as Record<string, unknown>;
    const after = await service.workflowStore.getState();

    expect(response.status).toBe(200);
    expect({ stage: after.stage, candidates: after.candidates, records: after.records, files: after.files }).toEqual({
      stage: before.stage,
      candidates: before.candidates,
      records: before.records,
      files: before.files,
    });
    expect(projection).toMatchObject({
      step: "담당자 확인",
      documentAsset: {
        building_id: "bld-cobalt",
        document_type: "leasing_flyer",
        source_format: "pdf",
        source_origin: "ephemeral_private_qa",
        status: "registered",
        review_policy: "publishable_reference",
      },
    });
  });

  it("registers a Pacific Gate non-JSON document against the selected portfolio building", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const handlers = createBuildingUpdateHandlers(await createService());
    const bytes = syntheticPdfFixture();
    const form = new FormData();
    form.set("actor_id", "usr-junior");
    form.set("expected_version", "0");
    form.set("building_id", "bld-pacific-gate");
    form.set("building_name", "Pacific Gate Tower");
    form.set("document_type", "leasing_flyer");
    form.set("file", new File([Uint8Array.from(bytes).buffer], "Synthetic_Pacific_leasing_flyer_202607.pdf", { type: "application/pdf" }));

    const response = await handlers.post(new Request("http://localhost/api/building-updates", { method: "POST", body: form }));
    const projection = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(projection).toMatchObject({
      step: "담당자 확인",
      documentAsset: {
        building_id: "bld-pacific-gate",
        document_type: "leasing_flyer",
        status: "registered",
      },
    });
  });

  it("returns bounded reviewed candidate facts instead of full extracted text", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const handlers = createBuildingUpdateHandlers(await createService());
    const bytes = syntheticPdfFixture();

    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_Cobalt_owner_update_202607.pdf", "application/pdf", bytes, "monthly_owner_update"),
    }));
    const projection = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(projection);

    expect(projection).toMatchObject({
      analysis: {
        status: "candidate_ready",
        reviewed_candidate: {
          summary: expect.any(String),
          facts: expect.any(Array),
        },
      },
    });
    expect(serialized.length).toBeLessThan(16_000);
    expect(serialized).not.toContain("LeaseFlow synthetic floor plan");
  });

  it("reviews and publishes the current governed reference without changing official property data", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();

    const uploadResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm(
        "Synthetic_Cobalt_leasing_flyer_202607.pdf",
        "application/pdf",
        syntheticPdfFixture(),
        "leasing_flyer",
      ),
    }));
    const uploaded = await uploadResponse.json() as {
      version: number;
      step: string;
      allowedActions: string[];
      documentAsset: { id: string };
    };

    expect(uploadResponse.status).toBe(200);
    expect(uploaded.step).toBe("담당자 확인");
    expect(uploaded.allowedActions).toContain("review_document");
    expect(uploaded.allowedActions).not.toContain("register");

    const reviewResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review_document",
        actor_id: "usr-junior",
        expected_version: uploaded.version,
        document_id: uploaded.documentAsset.id,
        reviewed_summary: "합성 임대 안내자료의 범위와 건물 연결을 담당자가 확인했습니다.",
      }),
    }));
    const reviewed = await reviewResponse.json() as {
      version: number;
      step: string;
      documentAsset: { id: string; reviewed_summary: string | null };
    };

    expect(reviewResponse.status).toBe(200);
    expect(reviewed.step).toBe("최종 확인");
    expect(reviewed.documentAsset).toMatchObject({
      id: uploaded.documentAsset.id,
      reviewed_summary: "합성 임대 안내자료의 범위와 건물 연결을 담당자가 확인했습니다.",
    });

    const seniorProjection = await handlers.get(new Request("http://localhost/api/building-updates?actor_id=usr-senior"));
    const senior = await seniorProjection.json() as { version: number; allowedActions: string[] };
    expect(senior.allowedActions).toContain("publish_document");

    const publishResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "publish_document",
        actor_id: "usr-senior",
        expected_version: senior.version,
        document_id: uploaded.documentAsset.id,
      }),
    }));
    const published = await publishResponse.json() as { step: string; documentAsset: { id: string; status: string } };

    expect(publishResponse.status).toBe(200);
    expect(published.step).toBe("최신정보 반영");
    expect(published.documentAsset).toMatchObject({ id: uploaded.documentAsset.id, status: "published" });
    expect(officialPropertyState(await service.workflowStore.getState())).toEqual(officialPropertyState(before));
  });

  it("rejects a mismatched portfolio building id and name before saving the document", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();
    const form = uploadedSourceForm(
      "Synthetic_Cobalt_leasing_flyer_202607.pdf",
      "application/pdf",
      syntheticPdfFixture(),
      "leasing_flyer",
      { id: "bld-pacific-gate", name: "Cobalt Finance Center" },
    );

    const response = await handlers.post(new Request("http://localhost/api/building-updates", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "입력한 자료 정보를 다시 확인해 주세요." });
    await expect(service.workflowStore.getState()).resolves.toEqual(before);
    await expect(service.intakeStore.get()).resolves.toBeNull();
  });

  it("requires a portfolio building id for non-JSON documents", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();
    const form = uploadedSourceForm(
      "Synthetic_Cobalt_leasing_flyer_202607.pdf",
      "application/pdf",
      syntheticPdfFixture(),
      "leasing_flyer",
    );
    form.delete("building_id");

    const response = await handlers.post(new Request("http://localhost/api/building-updates", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "입력한 자료 정보를 다시 확인해 주세요." });
    await expect(service.workflowStore.getState()).resolves.toEqual(before);
    await expect(service.intakeStore.get()).resolves.toBeNull();
  });

  it.each([
    ["Synthetic_Cobalt_legal_202607.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "legal_document", syntheticDocxFixture(), "review_only"],
    ["Synthetic_Cobalt_area_202607.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "area_workbook", syntheticXlsxFixture(), "review_only"],
    ["Synthetic_Cobalt_floor_plan_202607.dwg", "application/acad", "floor_plan", fixtureEncoder.encode("AC1027 LeaseFlow synthetic DWG marker"), "manual_review"],
    ["Synthetic_Cobalt_floor_plan_textless_202607.pdf", "application/pdf", "floor_plan", syntheticPdfFixture(""), "manual_review"],
  ] as const)("blocks reference publication for %s", async (filename, mimeType, documentType, bytes, reviewPolicy) => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm(filename, mimeType, bytes, documentType),
    }));
    const projection = await response.json() as {
      version: number;
      step: string;
      allowedActions: string[];
      documentAsset: { id: string; document_type: string; review_policy: string; status: string };
    };

    expect(response.status).toBe(200);
    expect(projection).toMatchObject({
      documentAsset: { document_type: documentType, review_policy: reviewPolicy, status: "registered" },
    });
    expect(projection.step).toBe(reviewPolicy === "manual_review" ? "최종 확인" : "담당자 확인");
    expect(projection.allowedActions).not.toContain("register");
    expect(projection.allowedActions).not.toContain("publish_document");

    let expectedVersion = projection.version;
    if (reviewPolicy === "review_only") {
      const reviewResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_document",
          actor_id: "usr-junior",
          expected_version: expectedVersion,
          document_id: projection.documentAsset.id,
          reviewed_summary: "내부 검토용 합성 자료의 범위와 건물 연결을 확인했습니다.",
        }),
      }));
      const reviewed = await reviewResponse.json() as { version: number; step: string; allowedActions: string[] };
      expect(reviewResponse.status).toBe(200);
      expect(reviewed.step).toBe("최종 확인");
      expect(reviewed.allowedActions).toEqual([]);
      expectedVersion = reviewed.version;
    }

    const publishResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "publish_document",
        actor_id: "usr-senior",
        expected_version: expectedVersion,
        document_id: projection.documentAsset.id,
      }),
    }));

    expect(publishResponse.status).toBe(409);
    expect((await service.workflowStore.getState()).asset_registry.assets
      .find((asset) => asset.id === projection.documentAsset.id)?.status).not.toBe("published");
  });

  it("rejects identical document bytes when they are registered for a different building without changing state or intake", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const bytes = syntheticPdfFixture();

    const first = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_Cobalt_flyer.pdf", "application/pdf", bytes, "leasing_flyer"),
    }));
    expect(first.status).toBe(200);
    const afterFirst = await service.workflowStore.getState();
    const intakeAfterFirst = await service.intakeStore.get();

    const second = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm(
        "Synthetic_Pacific_flyer.pdf",
        "application/pdf",
        bytes,
        "leasing_flyer",
        { id: "bld-pacific-gate", name: "Pacific Gate Tower" },
        afterFirst.revision,
      ),
    }));

    expect(second.status).toBe(400);
    await expect(service.workflowStore.getState()).resolves.toEqual(afterFirst);
    await expect(service.intakeStore.get()).resolves.toEqual(intakeAfterFirst);
  });

  it("reuses the canonical document id when the same document is uploaded again for the same building", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const bytes = syntheticPdfFixture();

    const firstResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_Cobalt_flyer.pdf", "application/pdf", bytes, "leasing_flyer"),
    }));
    const first = await firstResponse.json() as {
      version: number;
      documentAsset: { id: string };
    };
    expect(firstResponse.status).toBe(200);

    const secondResponse = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm(
        "Synthetic_Cobalt_flyer_copy.pdf",
        "application/pdf",
        bytes,
        "leasing_flyer",
        undefined,
        first.version,
      ),
    }));
    const second = await secondResponse.json() as {
      step: string;
      allowedActions: string[];
      documentAsset: { id: string };
    };
    const intake = await service.intakeStore.get();
    const canonicalAsset = (await service.workflowStore.getState()).asset_registry.assets
      .find((asset) => asset.id === first.documentAsset.id);

    expect(secondResponse.status).toBe(200);
    expect(second.step).toBe("담당자 확인");
    expect(second.allowedActions).toContain("review_document");
    expect(second.documentAsset.id).toBe(first.documentAsset.id);
    expect(canonicalAsset?.observed_filenames).toEqual([
      "Synthetic_Cobalt_flyer.pdf",
      "Synthetic_Cobalt_flyer_copy.pdf",
    ]);
    expect(intake?.document_asset_id).toBe(first.documentAsset.id);
  });

  it("rejects a stale review_document revision through the existing building-updates endpoint", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const handlers = createBuildingUpdateHandlers(await createService());
    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review_document",
        actor_id: "usr-junior",
        expected_version: -1,
        document_id: "doc-owner-update-july",
        reviewed_summary: "Bounded reviewed summary.",
      }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "다른 변경이 먼저 반영되었습니다. 최신 내용을 다시 확인해 주세요." });
  });

  it.each([
    ["pdf", "Synthetic_Cobalt_floor_plan_20260720.pdf", "application/pdf", "floor_plan", syntheticPdfFixture()],
    ["xlsx", "Synthetic_Cobalt_area_20260720.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "area_workbook", syntheticXlsxFixture()],
    ["docx", "Synthetic_Cobalt_legal_20260720.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "legal_document", syntheticDocxFixture()],
  ] as const)("accepts a synthetic %s into candidate metadata without publishing official facts", async (format, filename, mimeType, documentType, bytes) => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.projection("usr-junior", new Date("2026-07-20T00:00:00.000Z"));

    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm(filename, mimeType, bytes, documentType),
    }));

    expect(response.status).toBe(200);
    const projection = await response.json();
    expect(projection).toMatchObject({
      uploadedFile: { original_filename: filename, mime_type: mimeType, byte_size: bytes.byteLength },
      analysis: { status: "candidate_ready", source_format: format },
    });
    expect(projection.step).not.toBe("최신정보 반영");
    expect(projection.currentFacts).toEqual(before.currentFacts);
    if (documentType === "floor_plan") {
      expect(projection.documentAsset).toMatchObject({ review_policy: "review_only", status: "registered" });
      expect(projection.allowedActions).toContain("review_document");
      expect(projection.allowedActions).not.toContain("publish_document");
    }
  });

  it("leaves the pre-candidate official snapshot unchanged when signature validation rejects a file", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();

    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_area.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", syntheticPdfFixture(), "area_workbook"),
    }));

    expect(response.status).toBe(400);
    await expect(service.workflowStore.getState()).resolves.toEqual(before);
    await expect(service.intakeStore.get()).resolves.toBeNull();
  });

  it("rejects a multipart request containing more than one source file", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const repository = path.basename(process.cwd()) === "admin-web" ? path.resolve(process.cwd(), "../..") : process.cwd();
    const sourceBytes = await readFile(path.join(repository, "data/demo/source_update.json"));
    const form = uploadedSourceForm("source_update.json", "application/json", sourceBytes, "monthly_owner_update");
    form.append("file", new File([Uint8Array.from(sourceBytes).buffer], "source_update_copy.json", { type: "application/json" }));

    const response = await handlers.post(new Request("http://localhost/api/building-updates", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    await expect(service.intakeStore.get()).resolves.toBeNull();
  });

  it("records DWG for manual review with exact PDF-derivative guidance and no official mutation", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const service = await createService();
    const handlers = createBuildingUpdateHandlers(service);
    const before = await service.workflowStore.getState();
    const bytes = fixtureEncoder.encode("AC1027 LeaseFlow synthetic DWG marker");

    const response = await handlers.post(new Request("http://localhost/api/building-updates", {
      method: "POST",
      body: uploadedSourceForm("Synthetic_Cobalt_floor_plan.dwg", "application/acad", bytes, "floor_plan"),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      uploadedFile: { original_filename: "Synthetic_Cobalt_floor_plan.dwg", mime_type: "application/acad" },
      analysis: { status: "manual_review", code: "UNSUPPORTED_DWG", message: DWG_GUIDANCE },
    });
    const after = await service.workflowStore.getState();
    expect(officialPropertyState(after)).toEqual(officialPropertyState(before));
    expect(after.asset_registry.assets.length).toBe(before.asset_registry.assets.length + 1);
  });
});
