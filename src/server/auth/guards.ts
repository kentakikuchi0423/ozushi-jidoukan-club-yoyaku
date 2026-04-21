import "server-only";

import type { FacilityCode } from "@/lib/facility";
import {
  computeIsSuperAdmin,
  fetchAdminFacilityCodes,
  hasFacilityPermission,
} from "./permissions";
import { getCurrentAdminId } from "./session";

// Route Handler / Server Action / Server Component から呼ぶ権限ガード。
// 失敗時は型付き Error を throw するので、呼び出し側で catch して 401 / 403
// を返すか、redirect する。Next.js の `forbidden()` ヘルパーを使う場合も
// 上位の try/catch で包む想定。

export class AuthenticationRequiredError extends Error {
  constructor(message = "認証が必要です。") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class FacilityPermissionDeniedError extends Error {
  constructor(public readonly facility: FacilityCode) {
    super(`館「${facility}」に対する権限がありません。`);
    this.name = "FacilityPermissionDeniedError";
  }
}

export class SuperAdminRequiredError extends Error {
  constructor() {
    super("この操作は 3 館すべての権限を持つ管理者のみ実行できます。");
    this.name = "SuperAdminRequiredError";
  }
}

export interface AdminContext {
  readonly adminId: string;
  readonly facilities: readonly FacilityCode[];
}

export async function requireAdmin(): Promise<AdminContext> {
  const adminId = await getCurrentAdminId();
  if (!adminId) throw new AuthenticationRequiredError();
  const facilities = await fetchAdminFacilityCodes(adminId);
  return { adminId, facilities };
}

export async function requireFacilityPermission(
  target: FacilityCode,
): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!hasFacilityPermission(ctx.facilities, target)) {
    throw new FacilityPermissionDeniedError(target);
  }
  return ctx;
}

export async function requireSuperAdmin(): Promise<AdminContext> {
  const ctx = await requireAdmin();
  if (!computeIsSuperAdmin(ctx.facilities)) {
    throw new SuperAdminRequiredError();
  }
  return ctx;
}
