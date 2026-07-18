export interface MobileWorkflowView {
  revision: number;
  publication_stage: string;
  requests: Array<{ id: string; source: "call" | "email"; status: "candidate" | "confirmed"; summary: {
    building_id: string | null; floor: string | null; requested_fields: string[]; requested_files: string[];
    recipient: { name: string | null; organization: string | null }; deadline: string | null;
    ambiguities: Array<{ field: string; reason: string }>;
  } }>;
  packages: Array<{ id: string; building_id: string; floor: string; status: "draft" | "edit_pending" | "approved" | "sent" | "stale";
    subject: string; body: string; facts: Array<{ label: string; value: number; unit: string; version_id: string; source_pointer: string }>;
    files: Array<{ filename: string; version_id: string; source_pointer: string }>;
    recipients: { to: string[]; cc: string[]; configuration_id: string }; unresolved: string[];
    protected_material_status: "verified"; edit_candidate: { subject: string; body: string } | null;
  }>;
  activities: Array<{ event_type: "package.sent.sandbox"; package_id: string; building_id: string; occurred_at: string; summary: string }>;
  audit: Array<{ event_label: string; occurred_at: string }>;
  labels: { mode: "DEMO"; role: "LM Manager"; delivery: "SANDBOX ONLY" };
}

type WorkflowAction =
  | { action: "import"; source: "call" | "email" }
  | { action: "confirm"; request_id: string }
  | { action: "draft"; request_id: string }
  | { action: "edit"; package_id: string; instruction: string }
  | { action: "decide"; package_id: string; decision: "accept" | "reject" }
  | { action: "approve"; package_id: string }
  | { action: "send"; package_id: string; idempotency_key: string };

export interface WorkflowClientOptions { baseUrl?: string; fetcher?: typeof fetch }

function endpoint(options: WorkflowClientOptions): string {
  const baseUrl = (options.baseUrl ?? process.env.EXPO_PUBLIC_LEASEFLOW_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/api/mobile/workflow`;
}

async function readResponse(response: Response): Promise<MobileWorkflowView> {
  const body = await response.json() as MobileWorkflowView | { error?: string };
  if (!response.ok) throw new Error("error" in body && body.error ? body.error : `Workflow request failed (${response.status}).`);
  return body as MobileWorkflowView;
}

export async function fetchMobileWorkflow(options: WorkflowClientOptions = {}): Promise<MobileWorkflowView> {
  return readResponse(await (options.fetcher ?? fetch)(endpoint(options), { headers: { Accept: "application/json" } }));
}

export async function mutateMobileWorkflow(
  revision: number,
  action: WorkflowAction,
  options: WorkflowClientOptions = {},
): Promise<MobileWorkflowView> {
  return readResponse(await (options.fetcher ?? fetch)(endpoint(options), {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...action, actor_id: "usr-manager", expected_revision: revision }),
  }));
}
