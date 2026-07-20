import {
  parsePublicOperationsSnapshot,
  type MobilePublishedSnapshot,
  type PublicOperationsSnapshot,
} from "@leaseflow/demo-data";
import type { MobileReportWorkflowView } from "./reports";
import type { MobileWorkflowView } from "./workflow";

export type MobileOperationsSnapshot = PublicOperationsSnapshot<MobileWorkflowView, MobileReportWorkflowView>;

export interface OperationsSnapshotClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface OperationsSnapshotErrorBody {
  code?: string;
  error?: string;
  current_revision?: number;
}

export class OperationsSnapshotHttpError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly currentRevision: number | undefined;

  constructor(status: number, body: OperationsSnapshotErrorBody) {
    super(body.error ?? `Operations snapshot request failed (${status}).`);
    this.name = "OperationsSnapshotHttpError";
    this.status = status;
    this.code = body.code;
    this.currentRevision = body.current_revision;
  }
}

const pendingByFetcher = new WeakMap<typeof fetch, Map<string, Promise<MobileOperationsSnapshot>>>();

function endpoint(options: OperationsSnapshotClientOptions): string {
  const baseUrl = (options.baseUrl
    ?? process.env.EXPO_PUBLIC_LEASEFLOW_API_URL
    ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/api/operations/snapshot?actor_id=usr-manager`;
}

async function requestSnapshot(url: string, fetcher: typeof fetch): Promise<MobileOperationsSnapshot> {
  const response = await fetcher(url, { headers: { Accept: "application/json" } });
  const body: unknown = await response.json();
  if (!response.ok) throw new OperationsSnapshotHttpError(response.status, body as OperationsSnapshotErrorBody);
  return parsePublicOperationsSnapshot<MobileWorkflowView, MobileReportWorkflowView>(body);
}

export function fetchOperationsSnapshot(
  options: OperationsSnapshotClientOptions = {},
): Promise<MobileOperationsSnapshot> {
  const fetcher = options.fetcher ?? fetch;
  const url = endpoint(options);
  const pending = pendingByFetcher.get(fetcher) ?? new Map<string, Promise<MobileOperationsSnapshot>>();
  pendingByFetcher.set(fetcher, pending);
  const existing = pending.get(url);
  if (existing) return existing;
  const request = requestSnapshot(url, fetcher).finally(() => pending.delete(url));
  pending.set(url, request);
  return request;
}

export function publishedFromOperationsSnapshot(snapshot: MobileOperationsSnapshot): MobilePublishedSnapshot {
  return snapshot.published;
}
