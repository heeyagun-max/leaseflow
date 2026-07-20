import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

type DocumentType = "monthly_owner_update" | "floor_plan" | "leasing_flyer" | "area_workbook" | "legal_document";

interface ParserInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  documentType: DocumentType;
}

interface AcceptedResult {
  status: "accepted";
  format: "json" | "pdf" | "xlsx" | "docx";
  normalized: {
    text: string;
    tables: string[][][];
    metadata: { pageCount?: number; sheetNames?: string[] };
  };
  warnings: string[];
}

interface ManualReviewResult {
  status: "manual_review";
  code: "UNSUPPORTED_DWG" | "EXTRACTION_LIMIT";
  message: string;
}

interface ParserModule {
  analyzeSourceDocument(input: ParserInput): AcceptedResult | ManualReviewResult | Promise<AcceptedResult | ManualReviewResult>;
}

const FORMER_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const MAX_NORMALIZED_TEXT_LENGTH = 200_000;
const DWG_GUIDANCE = "DWG는 자동으로 분석할 수 없습니다. PDF 변환본을 올리거나 수동 검토로 등록해 주세요.";
const PDF_MANUAL_REVIEW_GUIDANCE = "PDF에서 자동 추출할 텍스트를 찾지 못했습니다. 이미지 또는 도면 원문을 수동으로 검토해 주세요.";
const encoder = new TextEncoder();

async function loadParser(): Promise<ParserModule> {
  const modulePath = "./source-document-parser.server";
  try {
    return await import(modulePath) as ParserModule;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect.fail(`source-document-parser.server is not implemented: ${message}`);
  }
}

async function analyze(input: ParserInput) {
  return (await loadParser()).analyzeSourceDocument(input);
}

async function expectSourceError(input: ParserInput, code: string) {
  let thrown: unknown;
  try {
    await analyze(input);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toMatchObject({ name: "SourceDocumentError", code, publicMessage: expect.any(String) });
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries: Record<string, string>) {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const checksum = crc32(data);
    const local = concatBytes(
      uint32(0x04034b50), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(data.byteLength), uint32(data.byteLength), uint16(nameBytes.byteLength), uint16(0),
      nameBytes, data,
    );
    locals.push(local);
    central.push(concatBytes(
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(data.byteLength), uint32(data.byteLength), uint16(nameBytes.byteLength),
      uint16(0), uint16(0), uint16(0), uint16(0), uint32(0), uint32(offset), nameBytes,
    ));
    offset += local.byteLength;
  }
  const centralBytes = concatBytes(...central);
  return concatBytes(
    ...locals,
    centralBytes,
    uint32(0x06054b50), uint16(0), uint16(0), uint16(central.length), uint16(central.length),
    uint32(centralBytes.byteLength), uint32(offset), uint16(0),
  );
}

function syntheticPdf(text = "LeaseFlow synthetic Cobalt floor plan") {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
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
    offsets.push(encoder.encode(body).byteLength);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(body).byteLength;
  const xref = offsets.map((offset, index) => index === 0
    ? "0000000000 65535 f \n"
    : `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return encoder.encode(`${body}xref\n0 ${offsets.length}\n${xref}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
}

function syntheticDocx(text = "LeaseFlow synthetic legal update") {
  return storedZip({
    "[Content_Types].xml": "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>",
    "_rels/.rels": "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>",
    "word/document.xml": `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  });
}

function syntheticXlsx(text = "LeaseFlow synthetic area") {
  return storedZip({
    "[Content_Types].xml": "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>",
    "_rels/.rels": "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>",
    "xl/workbook.xml": "<?xml version=\"1.0\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Available Areas\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>",
    "xl/_rels/workbook.xml.rels": "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>",
    "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${text}</t></is></c></row></sheetData></worksheet>`,
  });
}

describe("source document parser accepted formats", () => {
  it.each([
    ["pdf", "Synthetic_Cobalt_floor_plan_20260720.pdf", "application/pdf", "floor_plan", syntheticPdf()],
    ["xlsx", "Synthetic_Cobalt_area_20260720.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "area_workbook", syntheticXlsx()],
    ["docx", "Synthetic_Cobalt_legal_20260720.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "legal_document", syntheticDocx()],
  ] as const)("accepts a signature-matched synthetic %s as normalized candidate input", async (format, filename, mimeType, documentType, bytes) => {
    const result = await analyze({ bytes, filename, mimeType, documentType });

    expect(result).toMatchObject({ status: "accepted", format, normalized: { text: expect.any(String), tables: expect.any(Array), metadata: expect.any(Object) }, warnings: expect.any(Array) });
  });

  it("bounds normalized text before it becomes candidate input", async () => {
    const bytes = syntheticPdf("S".repeat(MAX_NORMALIZED_TEXT_LENGTH + 1_000));

    const result = await analyze({ bytes, filename: "Synthetic_large.pdf", mimeType: "application/pdf", documentType: "floor_plan" });

    expect(result.status === "accepted" && result.normalized.text.length).toBeLessThanOrEqual(MAX_NORMALIZED_TEXT_LENGTH);
  });

  it("extracts real PDF text and page metadata instead of returning raw PDF bytes", async () => {
    const result = await analyze({ bytes: syntheticPdf("LeaseFlow extracted page text"), filename: "Synthetic_text.pdf", mimeType: "application/pdf", documentType: "leasing_flyer" });

    expect(result).toMatchObject({
      status: "accepted",
      format: "pdf",
      normalized: { text: "LeaseFlow extracted page text", metadata: { pageCount: 1 } },
    });
    expect(result.status === "accepted" && result.normalized.text).not.toContain("%PDF-");
  });
});

describe("source document parser rejection contract", () => {
  it("rejects an extension and signature mismatch", async () => {
    await expectSourceError({ bytes: syntheticPdf(), filename: "Synthetic_area.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", documentType: "area_workbook" }, "TYPE_MISMATCH");
  });

  it.each([
    ["Synthetic_document.pdf", "image/png", "floor_plan", syntheticPdf()],
    ["Synthetic_area.xlsx", "application/pdf", "area_workbook", syntheticXlsx()],
    ["Synthetic_legal.docx", "image/png", "legal_document", syntheticDocx()],
  ] as const)("rejects a declared MIME type that contradicts the document format: %s", async (filename, mimeType, documentType, bytes) => {
    await expectSourceError({ bytes, filename, mimeType, documentType }, "TYPE_MISMATCH");
  });

  it.each(["", "application/octet-stream"])("allows an unspecified generic MIME type and relies on PDF signature validation: %s", async (mimeType) => {
    await expect(analyze({ bytes: syntheticPdf(), filename: "Synthetic_document.pdf", mimeType, documentType: "floor_plan" })).resolves.toMatchObject({ status: "accepted", format: "pdf" });
  });

  it("rejects a generic ZIP container", async () => {
    await expectSourceError({ bytes: storedZip({ "notes.txt": "synthetic only" }), filename: "Synthetic_bundle.zip", mimeType: "application/zip", documentType: "monthly_owner_update" }, "INVALID_CONTAINER");
  });

  it.each(["Synthetic_area.xlsm", "Synthetic_legal.docm"])("rejects macro-enabled Office input: %s", async (filename) => {
    await expectSourceError({ bytes: filename.endsWith(".xlsm") ? syntheticXlsx() : syntheticDocx(), filename, mimeType: "application/zip", documentType: filename.endsWith(".xlsm") ? "area_workbook" : "legal_document" }, "MACRO_FORMAT");
  });

  it("rejects malformed PDF bytes", async () => {
    await expectSourceError({ bytes: encoder.encode("%PDF-1.4\nnot a document"), filename: "Synthetic_broken.pdf", mimeType: "application/pdf", documentType: "floor_plan" }, "PARSE_FAILED");
  });

  it("rejects structurally suggestive but unreadable PDF bytes instead of accepting a raw-byte fallback", async () => {
    const bytes = encoder.encode("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");

    await expectSourceError({ bytes, filename: "Synthetic_corrupt.pdf", mimeType: "application/pdf", documentType: "floor_plan" }, "PARSE_FAILED");
  });

  it("rejects an empty document", async () => {
    await expectSourceError({ bytes: new Uint8Array(), filename: "Synthetic_empty.pdf", mimeType: "application/pdf", documentType: "floor_plan" }, "EMPTY_FILE");
  });

  it.each([
    ["Synthetic_empty.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "area_workbook", syntheticXlsx("")],
    ["Synthetic_empty.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "legal_document", syntheticDocx("")],
  ] as const)("rejects a structurally valid Office document with no reviewable content: %s", async (filename, mimeType, documentType, bytes) => {
    await expectSourceError({ bytes, filename, mimeType, documentType }, "PARSE_FAILED");
  });

  it("analyzes a valid landlord document above the former 20MB limit", async () => {
    const bytes = syntheticPdf(`CBRE landlord leasing update ${"S".repeat(FORMER_UPLOAD_LIMIT_BYTES)}`);

    const result = await analyze({
      bytes,
      filename: "Synthetic_CBRE_large_leasing_flyer.pdf",
      mimeType: "application/pdf",
      documentType: "leasing_flyer",
    });

    expect(bytes.byteLength).toBeGreaterThan(FORMER_UPLOAD_LIMIT_BYTES);
    expect(result).toMatchObject({
      status: "accepted",
      format: "pdf",
      normalized: { metadata: { pageCount: 1 } },
      warnings: expect.any(Array),
    });
  });
});

describe("source document parser manual review contract", () => {
  it("routes a valid image-only or drawing PDF to manual review instead of accepting empty text", async () => {
    await expect(analyze({ bytes: syntheticPdf(""), filename: "Synthetic_drawing.pdf", mimeType: "application/pdf", documentType: "floor_plan" })).resolves.toEqual({
      status: "manual_review",
      code: "EXTRACTION_LIMIT",
      message: PDF_MANUAL_REVIEW_GUIDANCE,
    });
  });

  it("returns the exact Korean DWG derivative guidance", async () => {
    const bytes = concatBytes(encoder.encode("AC1027"), createHash("sha256").update("synthetic-dwg").digest());

    await expect(analyze({ bytes, filename: "Synthetic_Cobalt_plan.dwg", mimeType: "application/acad", documentType: "floor_plan" })).resolves.toEqual({
      status: "manual_review",
      code: "UNSUPPORTED_DWG",
      message: DWG_GUIDANCE,
    });
  });
});
