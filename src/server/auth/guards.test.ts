import { describe, expect, it } from "vitest";
import {
  AuthenticationRequiredError,
  FacilityPermissionDeniedError,
  SuperAdminRequiredError,
} from "./guards";

// エラークラスの shape（name / message / instanceof）を担保する。
// ガード本体の DB 呼び出しは integration test（Phase 6 後半）で検証する前提で、
// ここでは catch 側で型判定できることを確認する。

describe("AuthenticationRequiredError", () => {
  it("carries name='AuthenticationRequiredError' and a default message", () => {
    const err = new AuthenticationRequiredError();
    expect(err.name).toBe("AuthenticationRequiredError");
    expect(err.message).toMatch(/認証/);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("FacilityPermissionDeniedError", () => {
  it("carries name and references the facility in the message", () => {
    const err = new FacilityPermissionDeniedError("ozu");
    expect(err.name).toBe("FacilityPermissionDeniedError");
    expect(err.facility).toBe("ozu");
    expect(err.message).toContain("ozu");
  });
});

describe("SuperAdminRequiredError", () => {
  it("carries name='SuperAdminRequiredError' with a super-admin-only message", () => {
    const err = new SuperAdminRequiredError();
    expect(err.name).toBe("SuperAdminRequiredError");
    expect(err.message).toMatch(/全館管理者/);
  });
});
