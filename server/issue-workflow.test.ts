import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedTransitions } from "@/server/issue-workflow";

describe("issue workflow transitions", () => {
  it("allows confirm and false_positive from pending_review", () => {
    assert.deepEqual(allowedTransitions("pending_review"), [
      "confirmed",
      "false_positive",
    ]);
  });

  it("allows remediating and closed from confirmed", () => {
    assert.deepEqual(allowedTransitions("confirmed"), [
      "remediating",
      "closed",
    ]);
  });

  it("allows closed and reopen from false_positive", () => {
    assert.deepEqual(allowedTransitions("false_positive"), [
      "closed",
      "pending_review",
    ]);
  });

  it("allows pending_verification and confirmed from remediating", () => {
    assert.deepEqual(allowedTransitions("remediating"), [
      "pending_verification",
      "confirmed",
    ]);
  });

  it("allows closed and remediating from pending_verification", () => {
    assert.deepEqual(allowedTransitions("pending_verification"), [
      "closed",
      "remediating",
    ]);
  });

  it("allows reopen from closed", () => {
    assert.deepEqual(allowedTransitions("closed"), ["pending_review"]);
  });
});
