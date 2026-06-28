export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = "5 MB";

export const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;
export const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.join(",");

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string; code: string };

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index === -1) return "";
  return fileName.slice(index).toLowerCase();
}

export function isAllowedUploadFile(file: { name: string }): boolean {
  return ALLOWED_EXTENSIONS.includes(
    getFileExtension(file.name) as (typeof ALLOWED_EXTENSIONS)[number],
  );
}

export function validateUploadFile(file: File): UploadValidationResult {
  if (!isAllowedUploadFile(file)) {
    return {
      ok: false,
      message: "仅支持 .xlsx、.xls、.csv 格式",
      code: "INVALID_FILE_TYPE",
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      message: "文件不能为空",
      code: "EMPTY_FILE",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message: `文件大小不能超过 ${MAX_FILE_SIZE_LABEL}`,
      code: "FILE_TOO_LARGE",
    };
  }

  return { ok: true };
}
