import type { MobilePublishedSnapshot } from "@leaseflow/demo-data";
import { fetchOperationsSnapshot } from "./operations-snapshot";

export interface PublishedDataClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export async function fetchPublishedData(
  options: PublishedDataClientOptions = {},
): Promise<MobilePublishedSnapshot> {
  return (await fetchOperationsSnapshot(options)).published;
}
