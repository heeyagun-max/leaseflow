export interface DemoResetClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

interface DemoResetResponse {
  state: { revision: number };
}

function endpoint(options: DemoResetClientOptions): string {
  const baseUrl = (options.baseUrl ?? process.env.EXPO_PUBLIC_LEASEFLOW_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${baseUrl}/api/demo/reset`;
}

export async function resetDemo(
  revision: number,
  options: DemoResetClientOptions = {},
): Promise<DemoResetResponse> {
  const response = await (options.fetcher ?? fetch)(endpoint(options), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ actor_id: "usr-manager", expected_revision: revision }),
  });
  const body = await response.json() as DemoResetResponse | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body && body.error ? body.error : `Demo reset failed (${response.status}).`);
  }
  return body as DemoResetResponse;
}
