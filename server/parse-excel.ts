import * as XLSX from "xlsx";
import type { AuditRecord } from "@/types/audit";

export class ParseExcelError extends Error {
  readonly code = "PARSE_EXCEL_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ParseExcelError";
  }
}

type AuditRecordField =
  | "date"
  | "type"
  | "amount"
  | "vendor"
  | "invoiceId"
  | "category"
  | "department"
  | "region"
  | "approvedBy";

const COLUMN_ALIASES: Record<string, AuditRecordField> = {
  date: "date",
  日期: "date",
  type: "type",
  类型: "type",
  amount: "amount",
  金额: "amount",
  vendor: "vendor",
  供应商: "vendor",
  invoiceid: "invoiceId",
  invoice_id: "invoiceId",
  发票号: "invoiceId",
  发票编号: "invoiceId",
  category: "category",
  类别: "category",
  分类: "category",
  department: "department",
  部门: "department",
  region: "region",
  地区: "region",
  区域: "region",
  approvedby: "approvedBy",
  approved_by: "approvedBy",
  审批人: "approvedBy",
  审批: "approvedBy",
};

const REQUIRED_FIELDS: AuditRecordField[] = [
  "date",
  "type",
  "amount",
  "vendor",
  "invoiceId",
];

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function resolveField(header: string): AuditRecordField | undefined {
  const trimmed = header.trim().replace(/^\uFEFF/, "");
  const key = normalizeHeader(trimmed);
  return COLUMN_ALIASES[key] ?? COLUMN_ALIASES[trimmed];
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const text = String(value ?? "").trim();
  if (!text) {
    throw new ParseExcelError("日期不能为空");
  }

  return text;
}

function normalizeType(value: unknown): AuditRecord["type"] {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["income", "in", "收入", "收"].includes(text)) {
    return "income";
  }

  if (["expense", "out", "支出", "支", "费用"].includes(text)) {
    return "expense";
  }

  throw new ParseExcelError(`无法识别类型「${value}」，请使用 income/expense 或 收入/支出`);
}

function normalizeAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "")
    .replace(/,/g, "")
    .trim();

  if (!text) {
    throw new ParseExcelError("金额不能为空");
  }

  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    throw new ParseExcelError(`无效金额「${value}」`);
  }

  return amount;
}

function normalizeOptionalString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : text;
}

function mapRowToRecord(
  row: Record<string, unknown>,
  rowNumber: number,
): AuditRecord {
  const mapped: Partial<AuditRecord> = {};

  for (const [header, value] of Object.entries(row)) {
    const field = resolveField(header);
    if (!field) continue;

    switch (field) {
      case "date":
        mapped.date = normalizeDate(value);
        break;
      case "type":
        mapped.type = normalizeType(value);
        break;
      case "amount":
        mapped.amount = normalizeAmount(value);
        break;
      case "vendor":
        mapped.vendor = String(value ?? "").trim();
        break;
      case "invoiceId":
        mapped.invoiceId = String(value ?? "").trim();
        break;
      case "category":
        mapped.category = normalizeOptionalString(value);
        break;
      case "department":
        mapped.department = normalizeOptionalString(value);
        break;
      case "region":
        mapped.region = normalizeOptionalString(value);
        break;
      case "approvedBy":
        mapped.approvedBy = normalizeOptionalString(value);
        break;
      default:
        break;
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (mapped[field] === undefined || mapped[field] === "") {
      throw new ParseExcelError(`第 ${rowNumber} 行缺少必填列「${field}」`);
    }
  }

  return mapped as AuditRecord;
}

function readWorkbookRows(fileName: string, content: Uint8Array): Record<string, unknown>[] {
  const lowerName = fileName.toLowerCase();
  const isCsv = lowerName.endsWith(".csv");

  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(content), {
        type: "string",
        cellDates: true,
      })
    : XLSX.read(content, {
        type: "array",
        cellDates: true,
      });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ParseExcelError("文件中没有可读取的工作表");
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
}

/** Parse Excel / CSV upload into audit records */
export function parseFinancialFile(
  fileName: string,
  content: Uint8Array,
): AuditRecord[] {
  if (content.byteLength === 0) {
    throw new ParseExcelError("文件内容为空");
  }

  const rows = readWorkbookRows(fileName, content);
  if (rows.length === 0) {
    throw new ParseExcelError("文件中没有数据行");
  }

  const records: AuditRecord[] = [];

  rows.forEach((row, index) => {
    const hasValues = Object.values(row).some(
      (value) => String(value ?? "").trim() !== "",
    );
    if (!hasValues) return;

    records.push(mapRowToRecord(row, index + 2));
  });

  if (records.length === 0) {
    throw new ParseExcelError("未解析到有效的财务记录");
  }

  return records;
}
