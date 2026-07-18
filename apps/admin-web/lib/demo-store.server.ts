import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SourceCandidateSchema } from "@leaseflow/ai";
import {
  assertGovernedPublicationStateInvariants,
  confirmCandidates,
  publishConfirmedBatch,
  recordExtraction,
  type UserRole,
} from "@leaseflow/domain";
import {
  createInitialDemoState,
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
const persistedDemoStateSchema = z.object({
  schema_version: z.literal(1),
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
}).strict();

function parsePersistedState(value: unknown): DemoState {
  try {
    const state = persistedDemoStateSchema.parse(value) as DemoState;
    assertGovernedPublicationStateInvariants(state);
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

  constructor(storePath = process.env.LEASEFLOW_DEMO_STATE_PATH ?? defaultStorePath()) {
    this.storePath = path.resolve(storePath);
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

  private resolveActor(actorId: string): { id: string; role: UserRole } {
    const user = demoUsers.find((candidate) => candidate.id === actorId);
    if (!user) throw new Error(`Unknown demo actor: ${actorId}.`);
    return { id: user.id, role: user.role };
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
