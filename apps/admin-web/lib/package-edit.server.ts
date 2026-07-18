import { PackageEditSchema, createStructuredResponse, type PackageEdit } from "@leaseflow/ai";
import { renderOperationalPackageBody, type PackageFact, type PackageFile } from "@leaseflow/domain";

export interface PackageEditAdapterInput {
  schema: typeof PackageEditSchema; schemaName: string; developer: string; user: string; model?: string;
}
export type PackageEditAdapter = (input: PackageEditAdapterInput) => Promise<unknown>;
export interface PackageEditServiceOptions {
  adapter?: PackageEditAdapter;
  environment?: { DEMO_MODE?: string; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
}

const defaultAdapter: PackageEditAdapter = (input) => createStructuredResponse(input);

export async function createPackageEditCandidate(
  input: { subject: string; facts: PackageFact[]; files: PackageFile[]; instruction: string },
  options: PackageEditServiceOptions = {},
): Promise<{ mode: "live" | "credential_free_demo"; edit: { subject: string; body: string }; decision: PackageEdit }> {
  const environment = options.environment ?? process.env;
  if (environment.DEMO_MODE === "true" && !environment.OPENAI_API_KEY) {
    return {
      mode: "credential_free_demo",
      decision: PackageEditSchema.parse({ tone: "concise_courteous" }),
      edit: { subject: input.subject, body: renderOperationalPackageBody(input.facts, input.files, "concise_courteous") },
    };
  }
  const output = await (options.adapter ?? defaultAdapter)({
    schema: PackageEditSchema, schemaName: "leaseflow_package_edit",
    developer: "Choose only an allowed presentation tone. You cannot write or modify facts, attachments, recipients, approvals, filenames, sources, or version references.",
    user: JSON.stringify({ instruction: input.instruction }),
    ...(environment.OPENAI_MODEL ? { model: environment.OPENAI_MODEL } : {}),
  });
  const decision = PackageEditSchema.parse(output);
  return {
    mode: "live", decision,
    edit: { subject: input.subject, body: renderOperationalPackageBody(input.facts, input.files, decision.tone) },
  };
}
