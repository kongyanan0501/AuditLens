import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAttachmentKind,
  validateAttachmentFile,
} from "@/server/issue-attachments";

describe("issue attachment validation", () => {
  it("accepts evidence image and pdf", () => {
    assert.equal(
      validateAttachmentFile(
        {
          mimeType: "image/png",
          byteSize: 1024,
          fileName: "shot.png",
        },
        "evidence",
      ).ok,
      true,
    );
    assert.equal(
      validateAttachmentFile(
        {
          mimeType: "application/pdf",
          byteSize: 2048,
          fileName: "proof.pdf",
        },
        "evidence",
      ).ok,
      true,
    );
  });

  it("rejects spreadsheet as evidence", () => {
    const result = validateAttachmentFile(
      {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteSize: 1024,
        fileName: "fix.xlsx",
      },
      "evidence",
    );
    assert.equal(result.ok, false);
  });

  it("accepts corrected csv/xlsx", () => {
    assert.equal(
      validateAttachmentFile(
        {
          mimeType: "text/csv",
          byteSize: 100,
          fileName: "fixed.csv",
        },
        "corrected_file",
      ).ok,
      true,
    );
  });

  it("rejects oversized files", () => {
    const result = validateAttachmentFile(
      {
        mimeType: "image/png",
        byteSize: 11 * 1024 * 1024,
        fileName: "big.png",
      },
      "evidence",
    );
    assert.equal(result.ok, false);
  });

  it("recognizes attachment kinds", () => {
    assert.equal(isAttachmentKind("evidence"), true);
    assert.equal(isAttachmentKind("corrected_file"), true);
    assert.equal(isAttachmentKind("other"), false);
  });
});
