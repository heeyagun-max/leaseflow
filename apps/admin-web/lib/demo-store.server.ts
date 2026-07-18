import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SourceCandidateSchema } from "@leaseflow/ai";
import {
  approveOperationalPackage,
  assertOperationalPackageContentIntegrity,
  assertGovernedPublicationStateInvariants,
  confirmCandidates,
  confirmOperationalRequest,
  decidePackageEdit,
  draftOperationalPackage,
  importOperationalRequest,
  proposePackageEdit,
  publishConfirmedBatch,
  recordExtraction,
  sendOperationalPackage,
  type OperationalRequestExtraction,
  type UserRole,
} from "@leaseflow/domain";
import {
  createDemoDraftMaterial,
  createInitialDemoState,
  currentDemoMaterialVersionIds,
  demoUsers,
  mapSourceCandidatesToDomain,
  type DemoState,
} from "@leaseflow/demo-data";
import { z } from "zod/v3";

export class RevisionConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`Revision conflict: expected ${expected}, current revision is ${actual}.`);
  }
}

export class DemoStateCorruptError extends Error {
  constructor(message: string) {
    super(`Demo state is corrupt; refusing to continue: ${message}`);
  }
}

function defaultStorePath(): string {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
  return path.join(root, "data/demo/.runtime/state.v1.json");
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const buildingAccessConfigSchema = z.object({
  configuration_id: z.string().min(1),
  users: z.array(z.object({ user_id: z.string().min(1), building_ids: z.array(z.string().min(1)).min(1) }).strict()),
}).strict();
const recipientConfigSchema = z.object({
  id: z.string().min(1), building_id: z.string().min(1), purpose: z.literal("broker_package"),
  recipient_name: z.string().min(1), recipient_organization: z.string().min(1),
  to: z.array(z.string().email()).min(1), cc: z.array(z.string().email()),
}).strict();
export interface DemoRuntimeConfiguration {
  access: z.infer<typeof buildingAccessConfigSchema>;
  recipients: z.infer<typeof recipientConfigSchema>;
}

export async function loadDemoRuntimeConfiguration(): Promise<DemoRuntimeConfiguration> {
  const dataDirectory = path.dirname(path.dirname(defaultStorePath()));
  const [accessRaw, recipientsRaw] = await Promise.all([
    readFile(path.join(dataDirectory, "building_access.json"), "utf8"),
    readFile(path.join(dataDirectory, "broker_package_recipient_group.json"), "utf8"),
  ]);
  return {
    access: buildingAccessConfigSchema.parse(JSON.parse(accessRaw)),
    recipients: recipientConfigSchema.parse(JSON.parse(recipientsRaw)),
  };
}
const publicationStatusSchema = z.enum([
  "candidate", "junior_confirmed", "senior_approved", "published", "superseded", "rejected",
]);
const userRoleSchema = z.enum([
  "data_steward", "senior_reviewer", "lm_manager", "lm_member", "team_lead", "admin",
]);
const persistedValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const candidateSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  field: z.enum(["marketed_area_py", "floor_plan", "rent_free_months", "supported_parking_spaces"]),
  floor: z.string().min(1),
  target_type: z.enum(["record", "file"]),
  predecessor_version_id: z.string().min(1),
  candidate_version_id: z.string().min(1),
  previous_value: persistedValueSchema,
  proposed_value: persistedValueSchema,
  source_state: z.enum(["confirmed", "under_discussion", "unverified"]),
  source_pointer: z.string().min(1),
  confidence: z.number().min(0).max(1),
  external_shareable_candidate: z.boolean(),
  status: z.enum(["candidate", "junior_confirmed", "published"]),
}).strict();
const recordSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  kind: z.enum(["availability", "term"]),
  floor: z.string().min(1),
  field: z.enum(["marketed_area_py", "rent_free_months", "supported_parking_spaces"]),
  value: z.number(),
  version_no: z.number().int().positive(),
  status: publicationStatusSchema,
  valid_from: dateSchema,
  valid_to: dateSchema.nullable(),
  superseded: z.boolean(),
  external_shareable: z.boolean(),
}).strict();
const fileSchema = z.object({
  id: z.string().min(1),
  building_id: z.string().min(1),
  floor: z.string().min(1),
  filename: z.string().min(1),
  file_type: z.literal("floor_plan"),
  version_no: z.number().int().positive(),
  status: publicationStatusSchema,
  valid_from: dateSchema,
  valid_to: dateSchema.nullable(),
  superseded: z.boolean(),
  external_shareable: z.boolean(),
}).strict();
const auditSchema = z.object({
  id: z.string().min(1),
  event_type: z.enum([
    "source.extracted", "candidate.confirmed", "batch.senior_approved", "batch.published", "demo.reset",
  ]),
  actor_id: z.string().min(1),
  actor_role: userRoleSchema,
  entity_type: z.enum(["source", "candidate_batch", "publication_batch", "demo"]),
  entity_id: z.string().min(1),
  occurred_at: z.string().datetime(),
  metadata: z.record(z.unknown()),
}).strict();
const requestExtractionSchema = z.object({
  language: z.enum(["ko", "en", "mixed"]),
  building_mentions: z.array(z.object({ text: z.string(), resolved_building_id: z.string().nullable(), confidence: z.number().min(0).max(1) }).strict()),
  floor: z.string().nullable(),
  requested_fields: z.array(z.enum(["marketed_area", "rent_free", "supported_parking"])),
  requested_files: z.array(z.enum(["current_floor_plan"])),
  recipient: z.object({ name: z.string().nullable(), organization: z.string().nullable() }).strict(),
  deadline: z.string().nullable(),
  ambiguities: z.array(z.object({ field: z.string(), reason: z.string() }).strict()),
}).strict();
const packageFactSchema = z.object({
  field: z.enum(["marketed_area", "rent_free", "supported_parking"]), label: z.string(), value: z.number(),
  unit: z.enum(["py", "months", "spaces"]), version_id: z.string(), source_pointer: z.string(),
}).strict();
const packageFileSchema = z.object({ requested_file: z.literal("current_floor_plan"), filename: z.string(), version_id: z.string(), source_pointer: z.string() }).strict();
const operationalStateSchema = z.object({
  requests: z.array(z.object({
    id: z.string(), source: z.enum(["call", "email"]), source_id: z.string(), raw_text: z.string(), extraction: requestExtractionSchema,
    status: z.enum(["candidate", "confirmed"]), imported_at: z.string().datetime(), confirmed_at: z.string().datetime().nullable(),
  }).strict()),
  packages: z.array(z.object({
    id: z.string(), request_id: z.string(), building_id: z.string(), floor: z.string(),
    status: z.enum(["draft", "edit_pending", "approved", "sent", "stale"]), subject: z.string(), body: z.string(),
    facts: z.array(packageFactSchema), files: z.array(packageFileSchema),
    recipients: z.object({ to: z.array(z.string().email()), cc: z.array(z.string().email()), configuration_id: z.string() }).strict(),
    unresolved: z.array(z.string()),
    edit_candidate: z.object({ subject: z.string(), body: z.string(), instruction: z.string() }).strict().nullable(),
    approved_by: z.string().nullable(), approved_at: z.string().datetime().nullable(), sent_at: z.string().datetime().nullable(), idempotency_key: z.string().nullable(),
  }).strict()),
  activities: z.array(z.object({
    id: z.string(), event_type: z.literal("package.sent.sandbox"), package_id: z.string(), building_id: z.string(), occurred_at: z.string().datetime(), summary: z.string(),
  }).strict()),
  audit: z.array(z.object({
    id: z.string(), event_type: z.enum(["request.imported", "request.confirmed", "package.drafted", "package.edit_proposed", "package.edit_accepted", "package.edit_rejected", "package.approved", "package.sent.sandbox"]),
    actor_id: z.string(), actor_role: userRoleSchema, entity_id: z.string(), occurred_at: z.string().datetime(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }).strict()),
}).strict();
const persistedDemoStateSchema = z.object({
  schema_version: z.literal(2),
  source_id: z.literal("src-cobalt-jul"),
  revision: z.number().int().nonnegative(),
  effective_date: dateSchema,
  publication_scope: z.object({
    building_id: z.string().min(1),
    floor: z.string().min(1),
  }).strict(),
  stage: z.enum(["source_uploaded", "extracted_candidate", "junior_confirmed", "senior_approved", "published"]),
  candidates: z.array(candidateSchema),
  records: z.array(recordSchema),
  files: z.array(fileSchema),
  audit: z.array(auditSchema),
  operations: operationalStateSchema,
}).strict();

function assertOperationalStateInvariants(state: DemoState): void {
  const unique = (values: readonly string[], label: string) => {
    if (new Set(values).size !== values.length) throw new Error(`duplicate ${label} id`);
  };
  unique(state.operations.requests.map((item) => item.id), "operational request");
  unique(state.operations.packages.map((item) => item.id), "operational package");
  unique(state.operations.activities.map((item) => item.id), "operational activity");
  unique(state.operations.audit.map((item) => item.id), "operational audit");
  const requestIds = new Set(state.operations.requests.map((item) => item.id));
  const packageIds = new Set(state.operations.packages.map((item) => item.id));
  for (const item of state.operations.packages) {
    if (!requestIds.has(item.request_id)) throw new Error(`package ${item.id} references a missing request`);
    if (item.status === "sent" && (!item.sent_at || !item.idempotency_key || !item.approved_by)) {
      throw new Error(`sent package ${item.id} is missing approval or idempotency evidence`);
    }
  }
  for (const activity of state.operations.activities) {
    if (!packageIds.has(activity.package_id)) throw new Error(`activity ${activity.id} references a missing package`);
  }
}

function parsePersistedState(value: unknown): DemoState {
  try {
    const candidate = value as { schema_version?: unknown };
    const migrated = candidate?.schema_version === 1
      ? { ...(value as Record<string, unknown>), schema_version: 2, operations: { requests: [], packages: [], activities: [], audit: [] } }
      : value;
    const state = persistedDemoStateSchema.parse(migrated) as DemoState;
    assertGovernedPublicationStateInvariants(state);
    assertOperationalStateInvariants(state);
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid state";
    throw new DemoStateCorruptError(message);
  }
}

const pathLocks = new Map<string, Promise<void>>();

async function withPathLock<T>(storePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = pathLocks.get(storePath) ?? Promise.resolve();
  let release = () => {};
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  pathLocks.set(storePath, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (pathLocks.get(storePath) === tail) pathLocks.delete(storePath);
  }
}

/**
 * DEMO_MODE local adapter for one Node process. The promise lock is not a
 * production/multi-instance guarantee; a Supabase compare-and-swap adapter is
 * the intended later deployment boundary.
 */
export class DemoFileStore {
  readonly storePath: string;
  private readonly configLoader: () => Promise<DemoRuntimeConfiguration>;

  constructor(
    storePath = process.env.LEASEFLOW_DEMO_STATE_PATH ?? defaultStorePath(),
    configLoader: () => Promise<DemoRuntimeConfiguration> = loadDemoRuntimeConfiguration,
  ) {
    this.storePath = path.resolve(storePath);
    this.configLoader = configLoader;
  }

  async getState(): Promise<DemoState> {
    return withPathLock(this.storePath, () => this.readOrInitialize());
  }

  async reset(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoState> {
    return withPathLock(this.storePath, async () => {
      const actor = this.resolveActor(input.actor_id);
      const current = await this.readOrInitialize();
      this.requireRevision(current, input.expected_revision);
      const seed = createInitialDemoState();
      const resetState: DemoState = {
        ...seed,
        revision: current.revision + 1,
        audit: [...current.audit, {
          id: `audit-${current.audit.length + 1}`,
          event_type: "demo.reset",
          actor_id: actor.id,
          actor_role: actor.role,
          entity_type: "demo",
          entity_id: seed.source_id,
          occurred_at: input.occurred_at ?? new Date().toISOString(),
          metadata: { reset_from_revision: current.revision },
        }],
      };
      await this.writeState(resetState);
      return resetState;
    });
  }

  async extract(
    input: { actor_id: string; expected_revision: number; occurred_at?: string },
    extraction: unknown,
  ): Promise<DemoState> {
    const parsedExtraction = SourceCandidateSchema.parse(extraction);
    return this.mutate(input.expected_revision, (state) => recordExtraction(
      state,
      mapSourceCandidatesToDomain(state, parsedExtraction),
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async confirm(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => confirmCandidates(
      state,
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async publish(input: { actor_id: string; expected_revision: number; occurred_at?: string }): Promise<DemoState> {
    return this.mutate(input.expected_revision, (state) => publishConfirmedBatch(
      state,
      this.resolveActor(input.actor_id),
      input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async importRequest(input: {
    actor_id: string; expected_revision: number; request_id: string; source: "call" | "email";
    source_id: string; raw_text: string; extraction: OperationalRequestExtraction; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => importOperationalRequest(
      state.operations,
      { id: input.request_id, source: input.source, source_id: input.source_id, raw_text: input.raw_text, extraction: input.extraction },
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async confirmRequest(input: { actor_id: string; expected_revision: number; request_id: string; occurred_at?: string }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => confirmOperationalRequest(
      state.operations, input.request_id, this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async draftPackage(input: { actor_id: string; expected_revision: number; request_id: string; occurred_at?: string }): Promise<DemoState> {
    const config = await this.configLoader();
    return this.mutateOperation(input.expected_revision, (state) => {
      if (state.stage !== "published") throw new Error("Package drafting requires the Stage 2 published state.");
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      const request = state.operations.requests.find((item) => item.id === input.request_id);
      if (!request || request.extraction.recipient.name !== config.recipients.recipient_name
        || request.extraction.recipient.organization !== config.recipients.recipient_organization) {
        throw new Error("Confirmed request recipient identity does not match configured broker package recipient group.");
      }
      if (config.recipients.building_id !== state.publication_scope.building_id) {
        throw new Error("No exact configured broker package recipient group exists for this building and purpose.");
      }
      return draftOperationalPackage(
        state.operations, input.request_id, createDemoDraftMaterial(state),
        { to: [...config.recipients.to], cc: [...config.recipients.cc], configuration_id: config.recipients.id },
        this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
    });
  }

  async proposePackageEdit(input: {
    actor_id: string; expected_revision: number; package_id: string; subject: string; body: string; instruction: string; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => proposePackageEdit(
      state.operations, input.package_id,
      { subject: input.subject, body: input.body, instruction: input.instruction },
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async decidePackageEdit(input: {
    actor_id: string; expected_revision: number; package_id: string; decision: "accept" | "reject"; occurred_at?: string;
  }): Promise<DemoState> {
    return this.mutateOperation(input.expected_revision, (state) => decidePackageEdit(
      state.operations, input.package_id, input.decision,
      this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
    ));
  }

  async approvePackage(input: { actor_id: string; expected_revision: number; package_id: string; occurred_at?: string }): Promise<DemoState> {
    const config = await this.configLoader();
    return this.mutateOperation(input.expected_revision, (state) => {
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      this.assertPackageCanonicalMaterial(state, input.package_id);
      this.assertPackageConfiguration(state, input.package_id, config);
      return approveOperationalPackage(
        state.operations, input.package_id, this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
    });
  }

  async sendPackage(input: {
    actor_id: string; expected_revision: number; package_id: string; idempotency_key: string; occurred_at?: string;
  }): Promise<DemoState> {
    const config = await this.configLoader();
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.assertConfiguredAccess(config, input.actor_id, state.publication_scope.building_id);
      this.assertPackageConfiguration(state, input.package_id, config);
      this.assertPackageCanonicalMaterial(state, input.package_id);
      const existing = state.operations.packages.find((item) => item.id === input.package_id);
      if (existing?.status === "sent" && existing.idempotency_key === input.idempotency_key) {
        assertOperationalPackageContentIntegrity(existing);
        return state;
      }
      this.requireRevision(state, input.expected_revision);
      const operations = sendOperationalPackage(
        state.operations, input.package_id, input.idempotency_key, currentDemoMaterialVersionIds(state),
        this.resolveActor(input.actor_id), input.occurred_at ?? new Date().toISOString(),
      );
      const next = { ...state, revision: state.revision + 1, operations };
      this.assertOfficialProjectionUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  private resolveActor(actorId: string): { id: string; role: UserRole } {
    const user = demoUsers.find((candidate) => candidate.id === actorId);
    if (!user) throw new Error(`Unknown demo actor: ${actorId}.`);
    return { id: user.id, role: user.role };
  }

  private assertConfiguredAccess(config: DemoRuntimeConfiguration, userId: string, buildingId: string): void {
    const access = config.access.users.find((item) => item.user_id === userId);
    if (!access?.building_ids.includes(buildingId)) {
      throw new Error(`Demo user ${userId} is not authorized for building ${buildingId}.`);
    }
  }

  private assertPackageConfiguration(state: DemoState, packageId: string, config: DemoRuntimeConfiguration): void {
    const pkg = state.operations.packages.find((item) => item.id === packageId);
    if (!pkg) throw new Error(`Unknown package: ${packageId}.`);
    if (config.recipients.building_id !== pkg.building_id
      || pkg.recipients.configuration_id !== config.recipients.id
      || JSON.stringify(pkg.recipients.to) !== JSON.stringify(config.recipients.to)
      || JSON.stringify(pkg.recipients.cc) !== JSON.stringify(config.recipients.cc)) {
      throw new Error("Package recipients or authorization configuration diverged from the current exact configuration.");
    }
  }

  private async mutate(expectedRevision: number, command: (state: DemoState) => DemoState): Promise<DemoState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const next = command(state);
      await this.writeState(next);
      return next;
    });
  }

  private async mutateOperation(
    expectedRevision: number,
    command: (state: DemoState) => DemoState["operations"],
  ): Promise<DemoState> {
    return withPathLock(this.storePath, async () => {
      const state = await this.readOrInitialize();
      this.requireRevision(state, expectedRevision);
      const next: DemoState = { ...state, revision: state.revision + 1, operations: command(state) };
      this.assertOfficialProjectionUnchanged(state, next);
      await this.writeState(next);
      return next;
    });
  }

  private assertPackageCanonicalMaterial(state: DemoState, packageId: string): void {
    const target = state.operations.packages.find((item) => item.id === packageId);
    if (!target) throw new Error(`Unknown package: ${packageId}.`);
    const request = state.operations.requests.find((item) => item.id === target.request_id);
    if (!request) throw new Error(`Package ${packageId} references an unknown request.`);
    const material = createDemoDraftMaterial(state);
    const canonicalFacts = request.extraction.requested_fields.map((field) => {
      const fact = material.facts.find((item) => item.field === field);
      if (!fact) throw new Error(`No current published fact is available for ${field}.`);
      return fact;
    });
    const canonicalFiles = request.extraction.requested_files.map((requestedFile) => {
      const file = material.files.find((item) => item.requested_file === requestedFile);
      if (!file) throw new Error(`No current published file is available for ${requestedFile}.`);
      return file;
    });
    if (target.building_id !== material.building_id
      || target.floor !== material.floor
      || JSON.stringify(target.facts) !== JSON.stringify(canonicalFacts)
      || JSON.stringify(target.files) !== JSON.stringify(canonicalFiles)) {
      throw new Error("Package protected material diverged from the current canonical published material.");
    }
  }

  private assertOfficialProjectionUnchanged(before: DemoState, after: DemoState): void {
    const project = (state: DemoState) => ({
      source_id: state.source_id, effective_date: state.effective_date, publication_scope: state.publication_scope,
      stage: state.stage, candidates: state.candidates, records: state.records, files: state.files, audit: state.audit,
    });
    if (JSON.stringify(project(before)) !== JSON.stringify(project(after))) {
      throw new Error("Operational workflow attempted to mutate official publication data.");
    }
  }

  private requireRevision(state: DemoState, expected: number): void {
    if (state.revision !== expected) throw new RevisionConflictError(expected, state.revision);
  }

  private async readOrInitialize(): Promise<DemoState> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return parsePersistedState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const initial = createInitialDemoState();
        await this.writeState(initial);
        return initial;
      }
      if (error instanceof DemoStateCorruptError) throw error;
      if (error instanceof SyntaxError) throw new DemoStateCorruptError(error.message);
      throw error;
    }
  }

  private async writeState(state: DemoState): Promise<void> {
    const validated = parsePersistedState(state);
    const directory = path.dirname(this.storePath);
    await mkdir(directory, { recursive: true });
    const tempPath = `${this.storePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(tempPath, this.storePath);
  }
}

let singleton: DemoFileStore | undefined;

export function getDemoStore(): DemoFileStore {
  singleton ??= new DemoFileStore();
  return singleton;
}
