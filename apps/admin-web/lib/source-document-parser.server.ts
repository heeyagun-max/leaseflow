import path from "node:path";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_NORMALIZED_TEXT_LENGTH = 200_000;
const DWG_GUIDANCE = "DWG는 자동으로 분석할 수 없습니다. PDF 변환본을 올리거나 수동 검토로 등록해 주세요.";
const PDF_MANUAL_REVIEW_GUIDANCE = "PDF에서 자동 추출할 텍스트를 찾지 못했습니다. 이미지 또는 도면 원문을 수동으로 검토해 주세요.";
const MIME_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  ".json": ["application/json", "text/json"],
  ".pdf": ["application/pdf"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".dwg": ["application/acad", "application/x-acad", "application/autocad", "application/dwg", "image/vnd.dwg", "image/x-dwg"],
};

type DocumentType = "monthly_owner_update" | "floor_plan" | "leasing_flyer" | "area_workbook" | "legal_document";
type AcceptedFormat = "json" | "pdf" | "xlsx" | "docx";

export type SourceDocumentErrorCode =
  | "EMPTY_FILE"
  | "INVALID_CONTAINER"
  | "MACRO_FORMAT"
  | "PARSE_FAILED"
  | "TYPE_MISMATCH"
  | "UNSUPPORTED_FORMAT";

export class SourceDocumentError extends Error {
  readonly name = "SourceDocumentError";

  constructor(readonly code: SourceDocumentErrorCode, readonly publicMessage: string) {
    super(code);
  }
}

export type SourceDocumentAnalysis = {
  status: "accepted";
  format: AcceptedFormat;
  normalized: {
    text: string;
    tables: string[][][];
    metadata: { pageCount?: number; sheetNames?: string[] };
  };
  warnings: string[];
} | {
  status: "manual_review";
  code: "UNSUPPORTED_DWG" | "EXTRACTION_LIMIT";
  message: string;
};

interface SourceDocumentInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  documentType: DocumentType;
}

function sourceError(code: SourceDocumentErrorCode, publicMessage: string): never {
  throw new SourceDocumentError(code, publicMessage);
}

function validateMimeType(extension: string, mimeType: string) {
  const normalized = mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "application/octet-stream") return;
  const allowed = MIME_TYPES_BY_EXTENSION[extension];
  if (allowed && !allowed.includes(normalized)) {
    sourceError("TYPE_MISMATCH", "파일 확장자와 선언된 문서 형식이 일치하지 않습니다.");
  }
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return bytes.byteLength >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}

function normalizeText(value: string) {
  const normalized = value.replace(/\0/g, "").replace(/\r\n?/g, "\n").trim();
  return {
    text: normalized.slice(0, MAX_NORMALIZED_TEXT_LENGTH),
    truncated: normalized.length > MAX_NORMALIZED_TEXT_LENGTH,
  };
}

function zipEntryNames(bytes: Uint8Array) {
  const names: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    if ((flags & 0x0001) !== 0 || (flags & 0x0008) !== 0) {
      sourceError("INVALID_CONTAINER", "암호화되었거나 확인할 수 없는 압축 문서는 올릴 수 없습니다.");
    }
    const dataOffset = offset + 30 + nameLength + extraLength;
    const nextOffset = dataOffset + compressedSize;
    if (dataOffset > bytes.byteLength || nextOffset > bytes.byteLength) {
      sourceError("INVALID_CONTAINER", "문서 압축 구조를 확인할 수 없습니다.");
    }
    names.push(new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength)));
    offset = nextOffset;
  }
  return names;
}

function storedZipEntryTexts(bytes: Uint8Array) {
  const entries = new Map<string, string>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let extractedBytes = 0;
  while (offset + 30 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const dataOffset = offset + 30 + nameLength + extraLength;
    if (compression === 0 && /\.xml$/.test(name)) {
      extractedBytes += compressedSize;
      if (extractedBytes > MAX_NORMALIZED_TEXT_LENGTH * 5) break;
      entries.set(name, new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(dataOffset, dataOffset + compressedSize)));
    }
    offset = dataOffset + compressedSize;
  }
  return entries;
}

function decodeXmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

function inspectOfficeContainer(bytes: Uint8Array) {
  if (!hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    sourceError("TYPE_MISMATCH", "파일 확장자와 실제 문서 형식이 일치하지 않습니다.");
  }
  const entries = zipEntryNames(bytes);
  if (!entries.includes("[Content_Types].xml")) {
    sourceError("INVALID_CONTAINER", "일반 ZIP 파일은 올릴 수 없습니다. XLSX 또는 DOCX 원본을 올려 주세요.");
  }
  if (entries.some((entry) => /(^|\/)vbaProject\.bin$/i.test(entry))) {
    sourceError("MACRO_FORMAT", "매크로 포함 문서는 올릴 수 없습니다. XLSX 또는 DOCX로 저장해 주세요.");
  }
  if (entries.includes("xl/workbook.xml")) return "xlsx" as const;
  if (entries.includes("word/document.xml")) return "docx" as const;
  sourceError("INVALID_CONTAINER", "지원되는 Office 문서 구조를 확인할 수 없습니다.");
}

function parseJson(bytes: Uint8Array) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    JSON.parse(text);
    return normalizeText(text);
  } catch {
    sourceError("PARSE_FAILED", "JSON 문서 내용을 읽을 수 없습니다.");
  }
}

async function parsePdf(bytes: Uint8Array) {
  if (!hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    sourceError("TYPE_MISMATCH", "파일 확장자와 실제 PDF 형식이 일치하지 않습니다.");
  }
  const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.byteLength - 1024)));
  if (!tail.includes("%%EOF")) sourceError("PARSE_FAILED", "PDF 문서 내용을 읽을 수 없습니다.");
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes.slice());
  } catch {
    sourceError("PARSE_FAILED", "PDF 문서 내용을 읽을 수 없습니다.");
  }
  try {
    const result = await extractText(pdf, { mergePages: true });
    const normalized = normalizeText(result.text);
    if (!normalized.text) {
      return { status: "manual_review" as const, code: "EXTRACTION_LIMIT" as const, message: PDF_MANUAL_REVIEW_GUIDANCE };
    }
    return { status: "accepted" as const, ...normalized, pageCount: result.totalPages };
  } catch {
    return { status: "manual_review" as const, code: "EXTRACTION_LIMIT" as const, message: PDF_MANUAL_REVIEW_GUIDANCE };
  }
}

async function parseXlsx(bytes: Uint8Array) {
  try {
    const sheets = await readXlsxFile(Buffer.from(bytes));
    const tables = sheets.map(({ data }) => data.map((row) => row.map((cell) => cell == null ? "" : String(cell))));
    const normalized = normalizeText(tables.flatMap((table) => table.map((row) => row.join("\t"))).join("\n"));
    return { ...normalized, tables, sheetNames: sheets.map(({ sheet }) => sheet) };
  } catch {
    try {
      const entries = storedZipEntryTexts(bytes);
      const workbook = entries.get("xl/workbook.xml");
      const worksheets = [...entries.entries()].filter(([name]) => /^xl\/worksheets\/[^/]+\.xml$/.test(name));
      if (!workbook || worksheets.length === 0) sourceError("PARSE_FAILED", "XLSX 문서 내용을 읽을 수 없습니다.");
      const sheetNames = [...workbook.matchAll(/<sheet\b[^>]*\bname=(?:"([^"]*)"|'([^']*)')/g)].map((match) => match[1] ?? match[2] ?? "Sheet");
      const tables = worksheets.map(([, xml]) => [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
        [...(row[1] ?? "").matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/g)].map((cell) => decodeXmlText(cell[1] ?? "")),
      ));
      const normalized = normalizeText(tables.flatMap((table) => table.map((row) => row.join("\t"))).join("\n"));
      return { ...normalized, tables, sheetNames: sheetNames.length > 0 ? sheetNames : worksheets.map((_, index) => `Sheet ${index + 1}`) };
    } catch (error) {
      if (error instanceof SourceDocumentError) throw error;
      sourceError("PARSE_FAILED", "XLSX 문서 내용을 읽을 수 없습니다.");
    }
  }
}

async function parseDocx(bytes: Uint8Array) {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { ...normalizeText(result.value), warnings: result.messages.map(() => "DOCX 일부 내용을 단순 텍스트로 변환했습니다.") };
  } catch {
    sourceError("PARSE_FAILED", "DOCX 문서 내용을 읽을 수 없습니다.");
  }
}

export async function analyzeSourceDocument(input: SourceDocumentInput): Promise<SourceDocumentAnalysis> {
  if (input.bytes.byteLength === 0) sourceError("EMPTY_FILE", "빈 파일은 올릴 수 없습니다.");

  const filename = path.basename(input.filename);
  const extension = path.extname(filename).toLowerCase();
  if ([".xlsm", ".xltm", ".xlam", ".docm", ".dotm"].includes(extension)) {
    sourceError("MACRO_FORMAT", "매크로 포함 문서는 올릴 수 없습니다. XLSX 또는 DOCX로 저장해 주세요.");
  }
  if (/\.(json|pdf|xlsx|docx|dwg|xlsm|docm)\.[^.]+$/i.test(filename)) {
    sourceError("TYPE_MISMATCH", "이중 확장자 파일은 올릴 수 없습니다.");
  }
  validateMimeType(extension, input.mimeType);

  if (extension === ".dwg") {
    if (!new TextDecoder("ascii").decode(input.bytes.subarray(0, 6)).startsWith("AC10")) {
      sourceError("TYPE_MISMATCH", "파일 확장자와 실제 DWG 형식이 일치하지 않습니다.");
    }
    return { status: "manual_review", code: "UNSUPPORTED_DWG", message: DWG_GUIDANCE };
  }

  if (extension === ".zip") {
    if (hasPrefix(input.bytes, [0x50, 0x4b, 0x03, 0x04])) inspectOfficeContainer(input.bytes);
    sourceError("INVALID_CONTAINER", "일반 ZIP 파일은 올릴 수 없습니다. XLSX 또는 DOCX 원본을 올려 주세요.");
  }

  if (extension === ".json") {
    const normalized = parseJson(input.bytes);
    return { status: "accepted", format: "json", normalized: { text: normalized.text, tables: [], metadata: {} }, warnings: normalized.truncated ? ["분석 텍스트가 최대 길이로 제한되었습니다."] : [] };
  }
  if (extension === ".pdf") {
    const parsed = await parsePdf(input.bytes);
    if (parsed.status === "manual_review") return parsed;
    return { status: "accepted", format: "pdf", normalized: { text: parsed.text, tables: [], metadata: { pageCount: parsed.pageCount } }, warnings: parsed.truncated ? ["분석 텍스트가 최대 길이로 제한되었습니다."] : [] };
  }
  if (extension === ".xlsx" || extension === ".docx") {
    const kind = inspectOfficeContainer(input.bytes);
    if (`.${kind}` !== extension) sourceError("TYPE_MISMATCH", "파일 확장자와 실제 Office 문서 형식이 일치하지 않습니다.");
    if (kind === "xlsx") {
      const parsed = await parseXlsx(input.bytes);
      if (!parsed.text) sourceError("PARSE_FAILED", "문서에서 검토할 내용을 찾지 못했습니다.");
      return { status: "accepted", format: "xlsx", normalized: { text: parsed.text, tables: parsed.tables, metadata: { sheetNames: parsed.sheetNames } }, warnings: parsed.truncated ? ["분석 텍스트가 최대 길이로 제한되었습니다."] : [] };
    }
    const parsed = await parseDocx(input.bytes);
    if (!parsed.text) sourceError("PARSE_FAILED", "문서에서 검토할 내용을 찾지 못했습니다.");
    return { status: "accepted", format: "docx", normalized: { text: parsed.text, tables: [], metadata: {} }, warnings: [...parsed.warnings, ...(parsed.truncated ? ["분석 텍스트가 최대 길이로 제한되었습니다."] : [])] };
  }

  sourceError("UNSUPPORTED_FORMAT", "지원되는 JSON, PDF, XLSX, DOCX 또는 DWG 파일을 올려 주세요.");
}
