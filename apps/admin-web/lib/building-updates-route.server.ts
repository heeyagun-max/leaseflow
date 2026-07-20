import { NextResponse } from "next/server";
import { z } from "zod/v3";
import { assertDemoMode } from "./demo-mode.server";
import { RevisionConflictError } from "./demo-store.server";
import { BuildingUpdateService } from "./building-updates.server";
import { SourceDocumentError } from "./source-document-parser.server";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("register"), actor_id: z.string(), expected_version: z.number().int(), registration: z.unknown() }).strict(),
  z.object({ action: z.literal("confirm"), actor_id: z.string(), expected_version: z.number().int() }).strict(),
  z.object({ action: z.literal("publish"), actor_id: z.string(), expected_version: z.number().int() }).strict(),
  z.object({
    action: z.literal("review_document"), actor_id: z.string(), expected_version: z.number().int(),
    document_id: z.string().min(1), reviewed_summary: z.string().trim().min(1).max(500),
  }).strict(),
  z.object({
    action: z.literal("publish_document"), actor_id: z.string(), expected_version: z.number().int(),
    document_id: z.string().min(1),
  }).strict(),
]);

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof RevisionConflictError) return NextResponse.json({ error: "다른 변경이 먼저 반영되었습니다. 최신 내용을 다시 확인해 주세요." }, { status: 409 });
  if (message.includes("not allowed")) return NextResponse.json({ error: "현재 역할로 이 작업을 진행할 수 없습니다." }, { status: 403 });
  if (error instanceof SourceDocumentError) return NextResponse.json({ error: error.publicMessage }, { status: 400 });
  if (message.includes("file type") || message.includes("source content") || message.includes("document type")) {
    return NextResponse.json({ error: "첨부 파일 형식, 자료 종류, 선택한 건물을 다시 확인해 주세요." }, { status: 400 });
  }
  if (error instanceof z.ZodError || message.startsWith("Unknown ")) return NextResponse.json({ error: "입력한 자료 정보를 다시 확인해 주세요." }, { status: 400 });
  if (message.includes("manual review") || message.includes("requires manual")) {
    return NextResponse.json({ error: "이 자료는 원문을 직접 확인해야 하므로 외부 사용 단계로 진행할 수 없습니다." }, { status: 409 });
  }
  if (message.includes("review-only") || message.includes("Review-only") || message.includes("cannot be published externally")) {
    return NextResponse.json({ error: "이 자료는 내부 검토용으로만 보관되며 외부 사용으로 전환할 수 없습니다." }, { status: 409 });
  }
  if (message.toLowerCase().includes("reviewed summary")) {
    return NextResponse.json({ error: "담당자 확인 내용을 먼저 입력해 주세요." }, { status: 409 });
  }
  if (message.includes("Illegal publication transition")) return NextResponse.json({ error: "현재 순서에서는 이 작업을 진행할 수 없습니다." }, { status: 409 });
  return NextResponse.json({ error: "작업을 완료하지 못했습니다. 기존 최신정보는 바뀌지 않았습니다." }, { status: 400 });
}

export function createBuildingUpdateHandlers(service: BuildingUpdateService) {
  return {
    async get(request: Request) {
      try {
        assertDemoMode();
        const actorId = new URL(request.url).searchParams.get("actor_id");
        if (!actorId) throw new Error("Unknown building-update actor.");
        return NextResponse.json(await service.projection(actorId));
      } catch (error) {
        return failure(error);
      }
    },
    async post(request: Request) {
      try {
        assertDemoMode();
        if (request.headers.get("content-type")?.includes("multipart/form-data")) {
          const form = await request.formData();
          const files = form.getAll("file");
          const file = files[0];
          const actorId = form.get("actor_id");
          const expectedVersion = Number(form.get("expected_version"));
          if (files.length !== 1 || !(file instanceof File) || typeof actorId !== "string" || !Number.isInteger(expectedVersion)) {
            throw new Error("Invalid building-update upload.");
          }
          await service.registerUpload(actorId, expectedVersion, {
            building_id: form.get("building_id") ?? undefined,
            building_name: form.get("building_name"),
            document_type: form.get("document_type"),
          }, {
            bytes: new Uint8Array(await file.arrayBuffer()),
            filename: file.name,
            mimeType: file.type,
          });
          return NextResponse.json(await service.projection(actorId));
        }
        const input = actionSchema.parse(await request.json());
        if (input.action === "register") await service.register(input.actor_id, input.expected_version, input.registration);
        if (input.action === "confirm") await service.confirm(input.actor_id, input.expected_version);
        if (input.action === "publish") await service.publish(input.actor_id, input.expected_version);
        if (input.action === "review_document") {
          await service.reviewDocument(input.actor_id, input.expected_version, input.document_id, input.reviewed_summary);
        }
        if (input.action === "publish_document") {
          await service.publishDocument(input.actor_id, input.expected_version, input.document_id);
        }
        return NextResponse.json(await service.projection(input.actor_id));
      } catch (error) {
        return failure(error);
      }
    },
  };
}
