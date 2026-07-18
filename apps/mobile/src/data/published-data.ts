import type { MobilePublishedSnapshot } from "@leaseflow/demo-data";

export interface PublishedDataClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export async function fetchPublishedData(
  options: PublishedDataClientOptions = {},
): Promise<MobilePublishedSnapshot> {
  const baseUrl = (options.baseUrl ?? process.env.EXPO_PUBLIC_LEASEFLOW_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const response = await (options.fetcher ?? fetch)(`${baseUrl}/api/mobile/published`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Published data request failed (${response.status}).`);
  return response.json() as Promise<MobilePublishedSnapshot>;
}
