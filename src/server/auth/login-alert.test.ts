import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock のファクトリは hoist されるため、内部で参照する変数は vi.hoisted で
// 一緒に巻き上げる必要がある（top-level の const を直接参照すると ReferenceError）。
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  auditInsert: vi.fn(),
  sendEmail: vi.fn(),
  fetchFacilities: vi.fn(),
}));

vi.mock("@/server/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ insert: mocks.auditInsert }),
  }),
}));

vi.mock("@/server/mail/send", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/server/facilities/list", () => ({
  fetchActiveFacilityContacts: mocks.fetchFacilities,
}));

// audit/log は内部で getSupabaseAdminClient を呼ぶ。上のモックで `from().insert()`
// を返しているのでそのまま動く。改めてモックしない。

import {
  LOGIN_ALERT_COOLDOWN_HOURS,
  LOGIN_ALERT_THRESHOLD,
  LOGIN_ALERT_WINDOW_MINUTES,
  maybeSendLoginAlert,
} from "./login-alert";

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.auditInsert.mockReset();
  mocks.auditInsert.mockResolvedValue({ error: null });
  mocks.sendEmail.mockReset();
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.fetchFacilities.mockReset();
  mocks.fetchFacilities.mockResolvedValue([]);
});

function rpcResult(row: {
  admin_id: string | null;
  display_name?: string | null;
  failure_count: number;
  alert_sent_recently?: boolean;
}) {
  return {
    data: [
      {
        admin_id: row.admin_id,
        display_name: row.display_name ?? null,
        failure_count: row.failure_count,
        alert_sent_recently: row.alert_sent_recently ?? false,
      },
    ],
    error: null,
  };
}

describe("maybeSendLoginAlert", () => {
  it("invokes evaluate_login_alert with the configured window / cooldown", async () => {
    mocks.rpc.mockResolvedValue(
      rpcResult({ admin_id: null, failure_count: 0 }),
    );
    await maybeSendLoginAlert("kikukiku@example.com");
    expect(mocks.rpc).toHaveBeenCalledWith("evaluate_login_alert", {
      p_email: "kikukiku@example.com",
      p_window_minutes: LOGIN_ALERT_WINDOW_MINUTES,
      p_cooldown_hours: LOGIN_ALERT_COOLDOWN_HOURS,
    });
  });

  it("does NOT send when the email is below the threshold", async () => {
    mocks.rpc.mockResolvedValue(
      rpcResult({
        admin_id: "admin-1",
        failure_count: LOGIN_ALERT_THRESHOLD - 1,
      }),
    );
    await maybeSendLoginAlert("ok@example.com");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("sends and writes audit when threshold is reached", async () => {
    mocks.rpc.mockResolvedValue(
      rpcResult({
        admin_id: "admin-1",
        display_name: "館長 太郎",
        failure_count: LOGIN_ALERT_THRESHOLD,
      }),
    );
    await maybeSendLoginAlert("alert@example.com");

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({
      tag: "admin.login.alert",
      to: "alert@example.com",
    });

    expect(mocks.auditInsert).toHaveBeenCalledTimes(1);
    expect(mocks.auditInsert.mock.calls[0][0]).toMatchObject({
      action: "admin.login.alert_sent",
      admin_id: "admin-1",
      target_type: "admin",
      metadata: {
        email: "alert@example.com",
        threshold: LOGIN_ALERT_THRESHOLD,
        window_minutes: LOGIN_ALERT_WINDOW_MINUTES,
      },
    });
  });

  it("skips sending when the email is not registered as an admin", async () => {
    mocks.rpc.mockResolvedValue(
      rpcResult({
        admin_id: null,
        failure_count: LOGIN_ALERT_THRESHOLD * 2,
      }),
    );
    await maybeSendLoginAlert("stranger@example.com");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("skips sending when an alert was already sent in the cooldown window", async () => {
    mocks.rpc.mockResolvedValue(
      rpcResult({
        admin_id: "admin-1",
        failure_count: LOGIN_ALERT_THRESHOLD + 3,
        alert_sent_recently: true,
      }),
    );
    await maybeSendLoginAlert("admin@example.com");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.auditInsert).not.toHaveBeenCalled();
  });

  it("does not throw when the rpc returns an error", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    await expect(maybeSendLoginAlert("x@example.com")).resolves.toBeUndefined();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("trims input and ignores empty emails", async () => {
    await maybeSendLoginAlert("   ");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
